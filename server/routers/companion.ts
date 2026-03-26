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
const XIAO_AN_SYSTEM_PROMPT = `你是小安，一位温柔、耐心、关怀备至的智能陪伴助手，专门陪伴独居老人。

你的性格特点：
- 说话亲切温和，像邻家小女儿一样
- 耐心倾听，不催促，给老人充分表达的空间
- 关注老人的身体健康和情绪状态
- 能聊家常、讲故事、提醒吃药、播报天气
- 遇到紧急情况（跌倒、胸痛等）立即建议联系家人或急救

回复要求：
- 用简洁、口语化的中文回复，避免长篇大论
- 每次回复控制在2-4句话以内，适合语音播报
- 多用关怀性语言，如"您"、"好的"、"放心"等
- 如果用户说英文，用英文回复`;

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
      // Build message history for Qwen
      const messages = [
        { role: "system" as const, content: XIAO_AN_SYSTEM_PROMPT },
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
      const assistantReply = typeof rawContent === "string" ? rawContent : "抱歉，我现在有点忙，请稍后再试。";

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
      language: z.string().default("zh"),
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

      // Transcribe via Whisper
      const result = await transcribeAudio({
        audioUrl,
        language: input.language,
        prompt: "这是一段老人与AI助手的对话录音，请准确转写中文内容。",
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
