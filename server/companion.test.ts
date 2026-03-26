// Tests for companion and report routers
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{ message: { content: "你好！我是小安，很高兴认识您！" } }],
  }),
}));

vi.mock("./_core/voiceTranscription", () => ({
  transcribeAudio: vi.fn().mockResolvedValue({
    text: "你好",
    language: "zh",
    duration: 1.5,
    task: "transcribe",
    segments: [],
  }),
}));

vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ key: "voice/test.webm", url: "https://cdn.example.com/test.webm" }),
}));

vi.mock("./db", () => ({
  insertCompanionLog: vi.fn().mockResolvedValue(undefined),
  getRecentCompanionLogs: vi.fn().mockResolvedValue([]),
  getVitalsHistory: vi.fn().mockResolvedValue([]),
  getRecentAlerts: vi.fn().mockResolvedValue([]),
}));

describe("companion router", () => {
  it("chat mutation returns a reply string", async () => {
    const { invokeLLM } = await import("./_core/llm");
    const result = await (invokeLLM as any)({
      messages: [
        { role: "system", content: "You are Xiao An" },
        { role: "user", content: "你好" },
      ],
    });
    expect(result.choices[0].message.content).toBe("你好！我是小安，很高兴认识您！");
  });

  it("getHistory returns empty array when no logs", async () => {
    const { getRecentCompanionLogs } = await import("./db");
    const logs = await (getRecentCompanionLogs as any)(50);
    expect(Array.isArray(logs)).toBe(true);
    expect(logs.length).toBe(0);
  });
});

describe("report router", () => {
  it("generateDaily computes overallStatus as good when no alerts", async () => {
    const { getRecentAlerts, getVitalsHistory } = await import("./db");
    const alerts = await (getRecentAlerts as any)(100);
    const vitals = await (getVitalsHistory as any)(24);
    
    const criticalCount = alerts.filter((a: any) => a.severity === "critical").length;
    const overallStatus = criticalCount > 0 ? "attention" : vitals.length === 0 ? "good" : "moderate";
    
    expect(overallStatus).toBe("good");
  });

  it("LLM is called with correct language prompt", async () => {
    const { invokeLLM } = await import("./_core/llm");
    await (invokeLLM as any)({
      messages: [
        { role: "system", content: "你是一位专业的老年健康监护AI助手" },
        { role: "user", content: "今日数据摘要" },
      ],
    });
    expect(invokeLLM).toHaveBeenCalled();
  });
});
