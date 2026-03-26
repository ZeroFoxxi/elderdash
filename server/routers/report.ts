// Guardian Dashboard - Daily Report Router
// Generates AI-powered daily health report using real sensor data

import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import { getVitalsHistory, getRecentAlerts, getRecentCompanionLogs } from "../db";

export const reportRouter = router({
  generateDaily: publicProcedure
    .input(z.object({
      language: z.enum(["zh", "en"]).default("zh"),
    }))
    .mutation(async ({ input }) => {
      // Fetch real data from DB
      const [vitalsRaw, alertsRaw, logsRaw] = await Promise.all([
        getVitalsHistory(24).catch(() => []),
        getRecentAlerts(100).catch(() => []),
        getRecentCompanionLogs(50).catch(() => []),
      ]);

      // Compute vitals statistics
      const vitalsStats = vitalsRaw.length > 0 ? {
        avgHR: Math.round(vitalsRaw.reduce((s, v) => s + (v.fusedHr ?? v.radarHr ?? 0), 0) / vitalsRaw.length),
        avgResp: Math.round(vitalsRaw.reduce((s, v) => s + (v.radarRr ?? 0), 0) / vitalsRaw.length),
        avgBVI: Math.round(vitalsRaw.reduce((s, v) => s + (v.bvi ?? 0), 0) / vitalsRaw.length),
        avgSpo2: Math.round(vitalsRaw.reduce((s, v) => s + (v.ppgSpo2 ?? 0), 0) / vitalsRaw.length),
        peakMovement: Math.max(...vitalsRaw.map(v => v.movement ?? 0)),
        dataPoints: vitalsRaw.length,
      } : {
        avgHR: 0, avgResp: 0, avgBVI: 0, avgSpo2: 0, peakMovement: 0, dataPoints: 0,
      };

      const alertStats = {
        critical: alertsRaw.filter(a => a.severity === "critical").length,
        warning: alertsRaw.filter(a => a.severity === "warning").length,
        info: alertsRaw.filter(a => a.severity === "info").length,
        total: alertsRaw.length,
      };

      const conversationCount = logsRaw.filter(l => l.logType === "chat").length;

      // Determine overall status
      const overallStatus: "good" | "moderate" | "attention" =
        alertStats.critical > 0 ? "attention"
        : alertStats.warning > 2 || vitalsStats.avgBVI < 30 ? "moderate"
        : "good";

      // Use Qwen to generate the narrative summary
      const dataContext = input.language === "zh"
        ? `今日健康数据摘要（过去24小时）：
- 平均心率：${vitalsStats.avgHR} bpm（正常范围60-100）
- 平均呼吸率：${vitalsStats.avgResp} /min
- 平均活力指数（BVI）：${vitalsStats.avgBVI}/100
- 平均血氧：${vitalsStats.avgSpo2}%
- 峰值体动：${vitalsStats.peakMovement.toFixed(1)}/10
- 数据采集点：${vitalsStats.dataPoints} 个
- 严重报警：${alertStats.critical} 次
- 警告：${alertStats.warning} 次
- AI对话次数：${conversationCount} 次`
        : `Today's health data summary (past 24 hours):
- Avg Heart Rate: ${vitalsStats.avgHR} bpm (normal: 60-100)
- Avg Resp Rate: ${vitalsStats.avgResp} /min
- Avg BVI: ${vitalsStats.avgBVI}/100
- Avg SpO2: ${vitalsStats.avgSpo2}%
- Peak Movement: ${vitalsStats.peakMovement.toFixed(1)}/10
- Data Points: ${vitalsStats.dataPoints}
- Critical Alerts: ${alertStats.critical}
- Warnings: ${alertStats.warning}
- AI Conversations: ${conversationCount}`;

      const systemPrompt = input.language === "zh"
        ? "你是一位专业的老年健康监护AI助手。根据提供的传感器数据，生成一段简洁专业的日报摘要（3-4句话），以及5条具体的健康建议。用JSON格式返回：{\"summary\": \"...\", \"recommendations\": [\"...\", \"...\", \"...\", \"...\", \"...\"]}"
        : "You are a professional elderly health monitoring AI. Based on the sensor data, generate a concise daily health summary (3-4 sentences) and 5 specific recommendations. Return JSON: {\"summary\": \"...\", \"recommendations\": [\"...\", \"...\", \"...\", \"...\", \"...\"]}";

      let summary = "";
      let recommendations: string[] = [];

      try {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: dataContext },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "daily_report",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  summary: { type: "string" },
                  recommendations: { type: "array", items: { type: "string" } },
                },
                required: ["summary", "recommendations"],
                additionalProperties: false,
              },
            },
          },
        });

        const content = response.choices?.[0]?.message?.content;
        if (typeof content === "string") {
          const parsed = JSON.parse(content);
          summary = parsed.summary ?? "";
          recommendations = parsed.recommendations ?? [];
        }
      } catch (e) {
        console.warn("[Report] LLM failed, using fallback:", e);
        summary = input.language === "zh"
          ? `今日共采集 ${vitalsStats.dataPoints} 个数据点。平均心率 ${vitalsStats.avgHR} bpm，活力指数 ${vitalsStats.avgBVI}/100，触发报警 ${alertStats.total} 次。`
          : `Collected ${vitalsStats.dataPoints} data points today. Avg HR ${vitalsStats.avgHR} bpm, BVI ${vitalsStats.avgBVI}/100, ${alertStats.total} alerts triggered.`;
        recommendations = input.language === "zh"
          ? ["保持规律作息", "适量运动", "注意补水", "定期测量血压", "与家人保持联系"]
          : ["Maintain regular schedule", "Light exercise daily", "Stay hydrated", "Monitor blood pressure", "Stay connected with family"];
      }

      return {
        date: new Date().toLocaleDateString(input.language === "zh" ? "zh-CN" : "en-US", {
          year: "numeric", month: "long", day: "numeric",
        }),
        summary,
        recommendations,
        vitals: vitalsStats,
        alertCount: alertStats,
        conversationCount,
        overallStatus,
        dataSource: vitalsStats.dataPoints > 0 ? "realtime" : "demo",
      };
    }),
});
