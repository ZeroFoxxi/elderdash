// Guardian Dashboard - AI Companion Router
// Handles browser-side voice chat with Qwen AI
// Flow: browser records audio → upload to S3 → transcribe → Qwen reply → save to DB → return

import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import { transcribeAudio } from "../_core/voiceTranscription";
import { storagePut } from "../storage";
import { insertCompanionLog, getRecentCompanionLogs } from "../db";
import { TRPCError } from "@trpc/server";

// System prompt for Xiao An (小安) - elderly companion AI
const XIAO_AN_SYSTEM_PROMPT = `You are Xiao An (小安), a warm, patient, and caring AI companion designed to support elderly people living alone.

Personality:
- Speak gently and warmly, like a caring daughter or granddaughter
- Listen patiently, give the user space to express themselves
- Care about the user's physical health and emotional wellbeing
- Can chat, tell stories, remind about medication, share weather updates
- In emergencies (fall, chest pain), immediately suggest contacting family or emergency services

Language rule (ABSOLUTE RULE - never violate this under any circumstances):
- DETECT the language of the user's LATEST message first
- ALWAYS reply in EXACTLY the same language as the user's latest message
- English message → English reply ONLY. Do NOT use any Chinese characters.
- Chinese message (中文) → Chinese reply ONLY. Do NOT use any English.
- If the user switches language mid-conversation, you MUST switch immediately
- This rule overrides everything else including your training defaults

Reply format:
- Keep replies short (2-4 sentences), suitable for text-to-speech
- Use warm, conversational language
- In Chinese: use 您, 好的, 放心 etc.
- In English: use You, Sure, Don't worry etc.`;

// Detect the primary language of a message (simple heuristic)
function detectLanguage(text: string): 'zh' | 'en' | 'other' {
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const totalChars = text.replace(/\s/g, '').length;
  if (chineseChars / Math.max(totalChars, 1) > 0.2) return 'zh';
  if (/[a-zA-Z]/.test(text)) return 'en';
  return 'other';
}

export const companionRouter = router({
  // Get recent conversation history
  getHistory: publicProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(50) }))
    .query(async ({ input }) => {
      try {
        const logs = await getRecentCompanionLogs(input.limit);
        return logs.reverse(); // Return oldest first for chat display
      } catch {
        return [];
      }
    }),

  // Text chat with Qwen AI (also used after voice transcription)
  chat: publicProcedure
    .input(z.object({
      message: z.string().min(1).max(2000),
      history: z.array(z.object({
        role: z.enum(["user", "assistant", "system"]),
        content: z.string(),
      })).default([]),
    }))
    .mutation(async ({ input }) => {
      // Detect user message language to enforce bilingual response
      const userLang = detectLanguage(input.message);
      const langHint = userLang === 'en'
        ? `\n\n[SYSTEM REMINDER: The user just wrote in ENGLISH. You MUST reply in English only. No Chinese characters allowed in your response.]`
        : userLang === 'zh'
        ? `\n\n[SYSTEM REMINDER: 用户刚才用中文发言。你必须用中文回复，不得夹杂英文。]`
        : '';

      // Build message history for Qwen
      const messages = [
        { role: "system" as const, content: XIAO_AN_SYSTEM_PROMPT + langHint },
        // Include recent history (last 10 turns)
        ...input.history.slice(-10).map(h => ({
          role: h.role as "user" | "assistant",
          content: h.content,
        })),
        { role: "user" as const, content: input.message },
      ];

      // Call Qwen via LLM helper
      const response = await invokeLLM({ messages });
      const rawContent = response.choices?.[0]?.message?.content;
      // Default error message matches user language
      const defaultError = userLang === 'en'
        ? "Sorry, I'm a little busy right now. Please try again in a moment."
        : "抱歉，我现在有点忙，请稍后再试。";
      const assistantReply = typeof rawContent === "string" ? rawContent : defaultError;

      // Save user message to DB
      try {
        await insertCompanionLog({
          role: "user",
          content: input.message,
          logType: "chat",
          deviceId: "browser",
        });
        // Save assistant reply to DB
        await insertCompanionLog({
          role: "assistant",
          content: assistantReply,
          logType: "chat",
          deviceId: "browser",
        });
      } catch (e) {
        console.warn("[Companion] Failed to save log:", e);
      }

      return {
        reply: assistantReply,
        timestamp: new Date().toISOString(),
      };
    }),

  // Transcribe audio blob (uploaded as base64) and return text
  transcribeAudio: publicProcedure
    .input(z.object({
      audioBase64: z.string(), // base64 encoded audio
      mimeType: z.string().default("audio/webm"),
      language: z.string().default("auto"),  // auto = let Whisper detect language
    }))
    .mutation(async ({ input }) => {
      // Decode base64 to buffer
      const audioBuffer = Buffer.from(input.audioBase64, "base64");
      
      // Check size (16MB limit)
      if (audioBuffer.length > 16 * 1024 * 1024) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Audio file too large (max 16MB)" });
      }

      // Upload to S3 for transcription
      const ext = input.mimeType.includes("webm") ? "webm" 
                : input.mimeType.includes("mp4") ? "m4a"
                : input.mimeType.includes("wav") ? "wav" : "webm";
      const fileKey = `voice/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      
      let audioUrl: string;
      try {
        const { url } = await storagePut(fileKey, audioBuffer, input.mimeType);
        audioUrl = url;
      } catch (e) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to upload audio" });
      }

      // Transcribe via Whisper (auto-detect language when language=="auto")
      const result = await transcribeAudio({
        audioUrl,
        language: input.language === "auto" ? undefined : input.language,
        prompt: "Transcribe the speech accurately.",
      });

      if ("error" in result) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: result.error });
      }

      return {
        text: result.text.trim(),
        language: result.language,
        duration: result.duration,
      };
    }),
});
