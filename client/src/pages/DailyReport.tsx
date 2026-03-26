// Guardian Dashboard - Daily Health Report Page
// AI-generated daily summary using real Jetson sensor data via Qwen
// Feature: Report language auto-syncs with UI language (no manual selection needed)

import { useState, useEffect } from 'react';
import { FileText, RefreshCw, Heart, Activity, Bell, MessageSquare, CheckCircle, AlertTriangle, TrendingUp, Database, Sparkles, Globe } from 'lucide-react';
import { useDashboard } from '../contexts/DashboardContext';
import { trpc } from '../lib/trpc';
import { toast } from 'sonner';

export default function DailyReport() {
  const { isEnglish, isDemoMode } = useDashboard();
  const [report, setReport] = useState<any>(null);
  const [reportLanguage, setReportLanguage] = useState<'zh' | 'en'>(isEnglish ? 'en' : 'zh');

  // Auto-sync report language with UI language
  // When the user switches language, update the indicator but don't auto-regenerate
  // (regeneration is explicit via button to avoid unnecessary API calls)
  useEffect(() => {
    setReportLanguage(isEnglish ? 'en' : 'zh');
    // If a report already exists in a different language, clear it so user knows to regenerate
    if (report) {
      const reportIsEnglish = report._language === 'en';
      if (reportIsEnglish !== isEnglish) {
        setReport(null);
        toast.info(
          isEnglish
            ? 'Language switched to English. Click "Generate Report" for an English report.'
            : '语言已切换为中文，请点击"生成报告"获取中文版报告。',
          { duration: 4000 }
        );
      }
    }
  }, [isEnglish]);

  const generateMutation = trpc.report.generateDaily.useMutation({
    onSuccess: (data) => {
      // Tag the report with the language it was generated in
      setReport({ ...data, _language: reportLanguage });
      toast.success(isEnglish ? 'Report generated!' : '报告已生成！');
    },
    onError: (err) => {
      toast.error(isEnglish ? 'Failed to generate report: ' + err.message : '报告生成失败：' + err.message);
    },
  });

  const handleGenerate = () => {
    // Always use current UI language for generation
    const lang = isEnglish ? 'en' : 'zh';
    setReportLanguage(lang);
    generateMutation.mutate({ language: lang });
  };

  const statusColors = {
    good: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', icon: <CheckCircle size={16} className="text-emerald-500" /> },
    moderate: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', icon: <AlertTriangle size={16} className="text-amber-500" /> },
    attention: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', icon: <AlertTriangle size={16} className="text-red-500" /> },
  };

  const overallStatus: 'good' | 'moderate' | 'attention' = (report?.overallStatus as 'good' | 'moderate' | 'attention') ?? 'good';

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-baseline gap-2">
            <h2 className="text-xl font-semibold text-foreground">
              {isEnglish ? 'Daily Health Report' : '每日健康报告'}
            </h2>
            <span className="text-xs text-muted-foreground font-normal flex items-center gap-1">
              <Sparkles size={11} className="text-primary" />
              {isEnglish ? 'Powered by Qwen AI' : 'Qwen AI 生成'}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isEnglish
              ? "AI-generated summary from real sensor data · Vitals · Alerts · Conversations"
              : "基于真实传感器数据的 AI 摘要 · 生理数据 · 报警记录 · AI 对话"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Language sync indicator */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted text-muted-foreground text-xs border border-border">
            <Globe size={12} />
            <span>{isEnglish ? 'EN' : '中文'}</span>
            <span className="text-[10px] opacity-60">{isEnglish ? '(auto)' : '（自动）'}</span>
          </div>

          <button
            onClick={handleGenerate}
            disabled={generateMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60 shadow-sm"
          >
            {generateMutation.isPending ? (
              <RefreshCw size={14} className="animate-spin" />
            ) : (
              <FileText size={14} />
            )}
            {generateMutation.isPending
              ? (isEnglish ? 'Generating...' : 'AI 生成中...')
              : (isEnglish ? 'Generate Report' : '生成报告')}
          </button>
        </div>
      </div>

      {/* Language auto-sync notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 flex items-center gap-2">
        <Globe size={13} className="text-blue-500 flex-shrink-0" />
        <p className="text-xs text-blue-700">
          {isEnglish
            ? 'Report language is automatically synced with the UI language. Switching language and regenerating will produce a report in the new language.'
            : '报告语言已与界面语言自动同步。切换语言后重新生成，将获得对应语言的报告。'}
        </p>
      </div>

      {/* Data source notice */}
      {isDemoMode && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 flex items-center gap-2">
          <AlertTriangle size={13} className="text-amber-500 flex-shrink-0" />
          <p className="text-xs text-amber-700">
            {isEnglish
              ? 'Currently in Demo Mode — report will use demo data. Switch to Realtime mode for actual Jetson data.'
              : '当前为演示模式——报告将使用演示数据。切换到实时模式可获取 Jetson 真实数据。'}
          </p>
        </div>
      )}

      {!report ? (
        /* Empty State */
        <div className="bg-white rounded-xl p-12 border border-border text-center">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Sparkles size={24} className="text-primary" />
          </div>
          <p className="text-sm font-semibold text-foreground mb-1">
            {isEnglish ? 'Click "Generate Report" for AI Health Summary' : '点击"生成报告"获取 AI 健康摘要'}
          </p>
          <p className="text-xs text-muted-foreground/70 mt-1 max-w-sm mx-auto">
            {isEnglish
              ? 'Qwen AI will analyze 24h sensor data and generate personalized health insights and recommendations in English.'
              : 'Qwen AI 将分析24小时传感器数据，生成个性化中文健康洞察和建议'}
          </p>
          <div className="flex items-center justify-center gap-4 mt-5 text-[11px] text-muted-foreground">
            {[
              { icon: <Heart size={12} className="text-rose-400" />, label: isEnglish ? 'Vitals Analysis' : '生理数据分析' },
              { icon: <Bell size={12} className="text-amber-400" />, label: isEnglish ? 'Alert Summary' : '报警摘要' },
              { icon: <TrendingUp size={12} className="text-primary" />, label: isEnglish ? 'AI Recommendations' : 'AI 建议' },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-1.5">
                {item.icon}
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Report Content */
        <div className="space-y-4">
          {/* Report Header */}
          <div className={`rounded-xl p-4 border ${statusColors[overallStatus].bg} ${statusColors[overallStatus].border}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {statusColors[overallStatus].icon}
                <span className={`text-sm font-semibold ${statusColors[overallStatus].text}`}>
                  {isEnglish
                    ? `Overall: ${overallStatus === 'good' ? 'Good' : overallStatus === 'moderate' ? 'Moderate' : 'Needs Attention'}`
                    : `总体状态：${overallStatus === 'good' ? '良好' : overallStatus === 'moderate' ? '一般' : '需关注'}`}
                </span>
                {report.dataSource === 'realtime' && (
                  <span className="flex items-center gap-1 text-[10px] bg-emerald-100 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded">
                    <Database size={9} />
                    {isEnglish ? 'Real Data' : '真实数据'}
                  </span>
                )}
                {/* Language badge */}
                <span className="flex items-center gap-1 text-[10px] bg-blue-50 text-blue-600 border border-blue-200 px-1.5 py-0.5 rounded">
                  <Globe size={9} />
                  {report._language === 'en' ? 'EN' : '中文'}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">{report.date}</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{report.summary}</p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { icon: <Heart size={16} className="text-rose-400 mx-auto mb-2" />, value: report.vitals.avgHR || '--', label: isEnglish ? 'Avg HR (bpm)' : '平均心率' },
              { icon: <Activity size={16} className="text-teal-400 mx-auto mb-2" />, value: report.vitals.avgBVI || '--', label: isEnglish ? 'Avg BVI' : '平均活力' },
              { icon: <Bell size={16} className="text-amber-400 mx-auto mb-2" />, value: report.alertCount.total, label: isEnglish ? 'Total Alerts' : '总报警' },
              { icon: <MessageSquare size={16} className="text-primary mx-auto mb-2" />, value: report.conversationCount, label: isEnglish ? 'AI Chats' : 'AI 对话' },
            ].map(stat => (
              <div key={stat.label} className="bg-white rounded-xl p-4 border border-border shadow-sm text-center">
                {stat.icon}
                <div className="text-2xl font-bold font-mono text-foreground">{stat.value}</div>
                <div className="text-[10px] text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Detailed Vitals */}
          {report.vitals.dataPoints > 0 && (
            <div className="bg-white rounded-xl p-5 border border-border shadow-sm">
              <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <Heart size={14} className="text-rose-400" />
                {isEnglish ? 'Vitals Summary' : '生理数据摘要'}
                <span className="text-[10px] text-muted-foreground font-normal ml-auto">
                  {isEnglish ? `${report.vitals.dataPoints} data points` : `${report.vitals.dataPoints} 个采集点`}
                </span>
              </h3>
              <div className="grid grid-cols-5 gap-4">
                {[
                  { label: isEnglish ? 'Avg HR' : '平均心率', value: `${report.vitals.avgHR} bpm`, color: 'text-rose-500' },
                  { label: isEnglish ? 'Avg Resp' : '平均呼吸率', value: `${report.vitals.avgResp} /min`, color: 'text-sky-500' },
                  { label: isEnglish ? 'Avg BVI' : '平均活力', value: `${report.vitals.avgBVI}/100`, color: 'text-amber-500' },
                  { label: isEnglish ? 'Avg SpO₂' : '平均血氧', value: `${report.vitals.avgSpo2}%`, color: 'text-emerald-500' },
                  { label: isEnglish ? 'Peak Movement' : '峰值体动', value: `${report.vitals.peakMovement.toFixed(1)}/10`, color: 'text-violet-500' },
                ].map(item => (
                  <div key={item.label} className="text-center">
                    <div className={`text-lg font-bold font-mono ${item.color}`}>{item.value}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{item.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

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

          {/* AI Recommendations */}
          {report.recommendations?.length > 0 && (
            <div className="bg-white rounded-xl p-5 border border-border shadow-sm">
              <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <Sparkles size={14} className="text-primary" />
                {isEnglish ? 'AI Recommendations' : 'AI 健康建议'}
              </h3>
              <div className="space-y-2.5">
                {report.recommendations.map((rec: string, i: number) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      i === report.recommendations.length - 1 && rec.includes('✓') ? 'bg-emerald-100' : 'bg-primary/10'
                    }`}>
                      <span className={`text-[10px] font-bold ${
                        i === report.recommendations.length - 1 && rec.includes('✓') ? 'text-emerald-600' : 'text-primary'
                      }`}>
                        {i + 1}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{rec}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="text-center text-[10px] text-muted-foreground py-2">
            {isEnglish
              ? 'Report generated by Guardian AI (Qwen) · NVIDIA Jetson Nano B01 · v2.9d'
              : '报告由 Guardian AI（Qwen）生成 · NVIDIA Jetson Nano B01 · v2.9d'}
          </div>
        </div>
      )}
    </div>
  );
}
