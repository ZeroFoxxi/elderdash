// Guardian Dashboard - Daily Health Report Page
// AI-generated daily summary with vitals, alerts, and recommendations

import { useState } from 'react';
import { FileText, Download, RefreshCw, Heart, Activity, Bell, MessageSquare, CheckCircle, AlertTriangle, TrendingUp } from 'lucide-react';
import { useDashboard } from '../contexts/DashboardContext';

interface ReportData {
  date: string;
  summary: string;
  summary_zh: string;
  vitals: {
    avgHR: number;
    avgResp: number;
    avgBVI: number;
    avgSpo2: number;
    peakMovement: number;
  };
  alertCount: { critical: number; warning: number; info: number };
  conversationCount: number;
  recommendations: string[];
  recommendations_zh: string[];
  overallStatus: 'good' | 'moderate' | 'attention';
}

function generateReport(): ReportData {
  return {
    date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    summary: 'Today\'s health monitoring shows generally stable vitals. Heart rate maintained within normal range (60-100 bpm) for 89% of the day. Behavioral Vitality Index averaged 46/100, indicating moderate activity levels. Two critical alerts were triggered (fall detection and SpO₂ low), both requiring immediate attention. AI companion conducted 3 proactive check-ins and responded to 2 alert events. Recommend encouraging more daytime activity to improve BVI scores.',
    summary_zh: '今日健康监测显示生理指标总体稳定。心率在正常范围（60-100 bpm）内维持了89%的时间。行为活力指数平均46/100，活动水平适中。触发了2次严重报警（跌倒检测和血氧偏低），均需立即关注。AI陪伴进行了3次主动问候，响应了2次报警事件。建议鼓励更多日间活动以提升BVI评分。',
    vitals: {
      avgHR: 78,
      avgResp: 16,
      avgBVI: 46,
      avgSpo2: 97,
      peakMovement: 8.3,
    },
    alertCount: { critical: 2, warning: 4, info: 2 },
    conversationCount: 5,
    recommendations: [
      'Encourage 20-30 minutes of light walking after meals to improve BVI',
      'Monitor SpO₂ levels closely — consider medical consultation if below 95% again',
      'Ensure adequate hydration throughout the day',
      'Consider adjusting sleep schedule — nocturnal anomaly detected at 03:22',
      'Positive: Heart rate remained stable; no sustained tachycardia episodes',
    ],
    recommendations_zh: [
      '建议饭后进行20-30分钟轻度散步，以提升BVI指数',
      '密切关注血氧水平——如再次低于95%，建议就医咨询',
      '确保全天充足补水',
      '考虑调整睡眠时间——凌晨03:22检测到夜间异常',
      '积极方面：心率保持稳定，未出现持续性心动过速',
    ],
    overallStatus: 'moderate',
  };
}

export default function DailyReport() {
  const { isEnglish, alerts, conversations } = useDashboard();
  const [report, setReport] = useState<ReportData | null>(null);
  const [generating, setGenerating] = useState(false);

  const handleGenerate = () => {
    setGenerating(true);
    setTimeout(() => {
      setReport(generateReport());
      setGenerating(false);
    }, 1800);
  };

  const statusColors = {
    good: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', icon: <CheckCircle size={16} className="text-emerald-500" /> },
    moderate: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', icon: <AlertTriangle size={16} className="text-amber-500" /> },
    attention: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', icon: <AlertTriangle size={16} className="text-red-500" /> },
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-baseline gap-2">
            <h2 className="text-xl font-semibold text-foreground">
              {isEnglish ? 'Daily Health Report' : '每日健康报告'}
            </h2>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isEnglish
              ? "Summarizes today's vitals, alerts, and AI conversations"
              : "汇总今日生理数据、报警记录和 AI 对话"}
          </p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
        >
          {generating ? (
            <RefreshCw size={14} className="animate-spin" />
          ) : (
            <FileText size={14} />
          )}
          {generating
            ? (isEnglish ? 'Generating...' : '生成中...')
            : (isEnglish ? 'Generate Report' : '生成报告')}
        </button>
      </div>

      {!report ? (
        /* Empty State */
        <div className="bg-white rounded-xl p-12 border border-border text-center">
          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <FileText size={24} className="text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-muted-foreground mb-1">
            {isEnglish ? 'Click "Generate Report" to view today\'s health summary' : '点击"生成报告"查看今日健康摘要'}
          </p>
          <p className="text-xs text-muted-foreground/60">
            {isEnglish
              ? 'Includes: Vitals · Alerts · AI Conversations · Recommendations'
              : '包含：生理数据 · 报警记录 · AI 对话 · 健康建议'}
          </p>
        </div>
      ) : (
        /* Report Content */
        <div className="space-y-4">
          {/* Report Header */}
          <div className={`rounded-xl p-4 border ${statusColors[report.overallStatus].bg} ${statusColors[report.overallStatus].border}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {statusColors[report.overallStatus].icon}
                <span className={`text-sm font-semibold ${statusColors[report.overallStatus].text}`}>
                  {isEnglish
                    ? `Overall Status: ${report.overallStatus === 'good' ? 'Good' : report.overallStatus === 'moderate' ? 'Moderate' : 'Needs Attention'}`
                    : `总体状态：${report.overallStatus === 'good' ? '良好' : report.overallStatus === 'moderate' ? '一般' : '需关注'}`}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{report.date}</span>
                <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <Download size={12} />
                  {isEnglish ? 'Export' : '导出'}
                </button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {isEnglish ? report.summary : report.summary_zh}
            </p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-white rounded-xl p-4 border border-border shadow-sm text-center">
              <Heart size={16} className="text-rose-400 mx-auto mb-2" />
              <div className="text-2xl font-bold font-mono text-foreground">{report.vitals.avgHR}</div>
              <div className="text-[10px] text-muted-foreground">{isEnglish ? 'Avg HR (bpm)' : '平均心率'}</div>
            </div>
            <div className="bg-white rounded-xl p-4 border border-border shadow-sm text-center">
              <Activity size={16} className="text-teal-400 mx-auto mb-2" />
              <div className="text-2xl font-bold font-mono text-foreground">{report.vitals.avgBVI}</div>
              <div className="text-[10px] text-muted-foreground">{isEnglish ? 'Avg BVI' : '平均活力指数'}</div>
            </div>
            <div className="bg-white rounded-xl p-4 border border-border shadow-sm text-center">
              <Bell size={16} className="text-amber-400 mx-auto mb-2" />
              <div className="text-2xl font-bold font-mono text-foreground">
                {report.alertCount.critical + report.alertCount.warning + report.alertCount.info}
              </div>
              <div className="text-[10px] text-muted-foreground">{isEnglish ? 'Total Alerts' : '总报警次数'}</div>
            </div>
            <div className="bg-white rounded-xl p-4 border border-border shadow-sm text-center">
              <MessageSquare size={16} className="text-primary mx-auto mb-2" />
              <div className="text-2xl font-bold font-mono text-foreground">{report.conversationCount}</div>
              <div className="text-[10px] text-muted-foreground">{isEnglish ? 'AI Interactions' : 'AI 交互次数'}</div>
            </div>
          </div>

          {/* Detailed Vitals */}
          <div className="bg-white rounded-xl p-5 border border-border shadow-sm">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Heart size={14} className="text-rose-400" />
              {isEnglish ? 'Vitals Summary' : '生理数据摘要'}
            </h3>
            <div className="grid grid-cols-5 gap-4">
              {[
                { label: isEnglish ? 'Avg HR' : '平均心率', value: `${report.vitals.avgHR} bpm`, color: 'text-rose-500' },
                { label: isEnglish ? 'Avg Resp' : '平均呼吸率', value: `${report.vitals.avgResp} /min`, color: 'text-sky-500' },
                { label: isEnglish ? 'Avg BVI' : '平均活力', value: `${report.vitals.avgBVI}/100`, color: 'text-amber-500' },
                { label: isEnglish ? 'Avg SpO₂' : '平均血氧', value: `${report.vitals.avgSpo2}%`, color: 'text-emerald-500' },
                { label: isEnglish ? 'Peak Movement' : '峰值体动', value: `${report.vitals.peakMovement}/10`, color: 'text-violet-500' },
              ].map(item => (
                <div key={item.label} className="text-center">
                  <div className={`text-lg font-bold font-mono ${item.color}`}>{item.value}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{item.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Alert Summary */}
          <div className="bg-white rounded-xl p-5 border border-border shadow-sm">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Bell size={14} className="text-amber-400" />
              {isEnglish ? 'Alert Summary' : '报警摘要'}
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-red-50 rounded-lg p-3 text-center border border-red-100">
                <div className="text-2xl font-bold font-mono text-red-500">{report.alertCount.critical}</div>
                <div className="text-[10px] text-red-600 mt-0.5">{isEnglish ? 'Critical' : '严重'}</div>
              </div>
              <div className="bg-amber-50 rounded-lg p-3 text-center border border-amber-100">
                <div className="text-2xl font-bold font-mono text-amber-500">{report.alertCount.warning}</div>
                <div className="text-[10px] text-amber-600 mt-0.5">{isEnglish ? 'Warning' : '警告'}</div>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 text-center border border-blue-100">
                <div className="text-2xl font-bold font-mono text-blue-500">{report.alertCount.info}</div>
                <div className="text-[10px] text-blue-600 mt-0.5">{isEnglish ? 'Info' : '信息'}</div>
              </div>
            </div>
          </div>

          {/* Recommendations */}
          <div className="bg-white rounded-xl p-5 border border-border shadow-sm">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <TrendingUp size={14} className="text-primary" />
              {isEnglish ? 'AI Recommendations' : 'AI 健康建议'}
            </h3>
            <div className="space-y-2">
              {(isEnglish ? report.recommendations : report.recommendations_zh).map((rec, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    i === 4 ? 'bg-emerald-100' : 'bg-primary/10'
                  }`}>
                    <span className={`text-[10px] font-bold ${i === 4 ? 'text-emerald-600' : 'text-primary'}`}>
                      {i === 4 ? '✓' : i + 1}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{rec}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="text-center text-[10px] text-muted-foreground py-2">
            {isEnglish
              ? 'Report generated by Guardian AI · NVIDIA Jetson Nano B01 · v2.9d'
              : '报告由 Guardian AI 生成 · NVIDIA Jetson Nano B01 · v2.9d'}
          </div>
        </div>
      )}
    </div>
  );
}
