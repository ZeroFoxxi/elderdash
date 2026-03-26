// Guardian Dashboard - Daily Health Report
// AI-generated daily summary using real Jetson sensor data via Qwen
// Feature: Professional medical report style + language auto-sync

import { useState, useEffect, useRef } from 'react';
import {
  FileText, RefreshCw, Heart, Activity, Bell, MessageSquare,
  CheckCircle, AlertTriangle, TrendingUp, Database, Sparkles,
  Globe, Printer, Shield, Cpu, Clock, User, ChevronRight,
} from 'lucide-react';
import { useDashboard } from '../contexts/DashboardContext';
import { trpc } from '../lib/trpc';
import { toast } from 'sonner';

export default function DailyReport() {
  const { isEnglish, isDemoMode } = useDashboard();
  const [report, setReport] = useState<any>(null);
  const [reportLanguage, setReportLanguage] = useState<'zh' | 'en'>(isEnglish ? 'en' : 'zh');
  const printRef = useRef<HTMLDivElement>(null);

  // Auto-sync report language with UI language
  useEffect(() => {
    setReportLanguage(isEnglish ? 'en' : 'zh');
    if (report) {
      const reportIsEnglish = report._language === 'en';
      if (reportIsEnglish !== isEnglish) {
        setReport(null);
        toast.info(
          isEnglish
            ? 'Language switched. Click "Generate Report" for an English report.'
            : '语言已切换，请点击"生成报告"获取中文版报告。',
          { duration: 4000 }
        );
      }
    }
  }, [isEnglish]);

  const generateMutation = trpc.report.generateDaily.useMutation({
    onSuccess: (data) => {
      setReport({ ...data, _language: reportLanguage });
      toast.success(isEnglish ? 'Report generated!' : '报告已生成！');
    },
    onError: (err) => {
      toast.error(isEnglish ? 'Failed: ' + err.message : '生成失败：' + err.message);
    },
  });

  const handleGenerate = () => {
    const lang = isEnglish ? 'en' : 'zh';
    setReportLanguage(lang);
    generateMutation.mutate({ language: lang });
  };

  const handlePrint = () => {
    window.print();
  };

  const overallStatus: 'good' | 'moderate' | 'attention' =
    (report?.overallStatus as 'good' | 'moderate' | 'attention') ?? 'good';

  const statusConfig = {
    good: {
      label: isEnglish ? 'Good' : '良好',
      color: '#10b981',
      bg: '#f0fdf4',
      border: '#bbf7d0',
      icon: <CheckCircle size={18} className="text-emerald-500" />,
      desc: isEnglish ? 'All vitals within normal range' : '各项生理指标均在正常范围内',
    },
    moderate: {
      label: isEnglish ? 'Moderate' : '一般',
      color: '#f59e0b',
      bg: '#fffbeb',
      border: '#fde68a',
      icon: <AlertTriangle size={18} className="text-amber-500" />,
      desc: isEnglish ? 'Some indicators need attention' : '部分指标需关注',
    },
    attention: {
      label: isEnglish ? 'Needs Attention' : '需关注',
      color: '#ef4444',
      bg: '#fef2f2',
      border: '#fecaca',
      icon: <AlertTriangle size={18} className="text-red-500" />,
      desc: isEnglish ? 'Multiple abnormal indicators detected' : '检测到多项异常指标',
    },
  };

  const sc = statusConfig[overallStatus];

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      {/* Toolbar */}
      <div className="bg-white border-b border-border px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <div>
          <div className="flex items-baseline gap-2">
            <h2 className="text-lg font-semibold text-foreground">
              {isEnglish ? 'Daily Health Report' : '每日健康报告'}
            </h2>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Sparkles size={10} className="text-primary" />
              {isEnglish ? 'Powered by Qwen AI' : 'Qwen AI 生成'}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {isEnglish
              ? 'AI-generated clinical summary · Vitals · Alerts · Conversations'
              : '基于真实传感器数据的 AI 健康摘要 · 生理数据 · 报警 · 对话'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Language indicator */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-600 text-xs border border-blue-200">
            <Globe size={11} />
            <span>{isEnglish ? 'EN' : '中文'}</span>
            <span className="text-[10px] opacity-60">{isEnglish ? '(auto)' : '（自动）'}</span>
          </div>

          {report && (
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:bg-muted transition-colors"
            >
              <Printer size={12} />
              {isEnglish ? 'Print / PDF' : '打印 / PDF'}
            </button>
          )}

          <button
            onClick={handleGenerate}
            disabled={generateMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60 shadow-sm"
          >
            {generateMutation.isPending
              ? <RefreshCw size={13} className="animate-spin" />
              : <FileText size={13} />}
            {generateMutation.isPending
              ? (isEnglish ? 'Generating...' : 'AI 生成中...')
              : (isEnglish ? 'Generate Report' : '生成报告')}
          </button>
        </div>
      </div>

      <div className="p-6 space-y-4 max-w-4xl mx-auto">
        {/* Notices */}
        {isDemoMode && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 flex items-center gap-2">
            <AlertTriangle size={13} className="text-amber-500 flex-shrink-0" />
            <p className="text-xs text-amber-700">
              {isEnglish
                ? 'Demo Mode — report uses simulated data. Switch to Realtime for actual Jetson data.'
                : '演示模式——报告使用模拟数据。切换到实时模式可获取 Jetson 真实数据。'}
            </p>
          </div>
        )}

        {!report ? (
          /* Empty State */
          <div className="bg-white rounded-2xl p-14 border border-border text-center shadow-sm">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
              <Sparkles size={28} className="text-primary" />
            </div>
            <p className="text-base font-semibold text-foreground mb-2">
              {isEnglish ? 'Generate AI Health Summary' : '生成 AI 健康摘要'}
            </p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
              {isEnglish
                ? 'Qwen AI analyzes 24h sensor data and generates a professional health report with personalized recommendations.'
                : 'Qwen AI 分析24小时传感器数据，生成包含个性化建议的专业健康报告。'}
            </p>
            <div className="flex items-center justify-center gap-6 mt-6 text-[11px] text-muted-foreground">
              {[
                { icon: <Heart size={13} className="text-rose-400" />, label: isEnglish ? 'Vitals Analysis' : '生理数据分析' },
                { icon: <Bell size={13} className="text-amber-400" />, label: isEnglish ? 'Alert Summary' : '报警摘要' },
                { icon: <TrendingUp size={13} className="text-primary" />, label: isEnglish ? 'AI Recommendations' : 'AI 健康建议' },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-2">
                  {item.icon}
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
            <button
              onClick={handleGenerate}
              disabled={generateMutation.isPending}
              className="mt-6 flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60 mx-auto"
            >
              {generateMutation.isPending
                ? <RefreshCw size={14} className="animate-spin" />
                : <Sparkles size={14} />}
              {generateMutation.isPending
                ? (isEnglish ? 'Generating...' : 'AI 生成中...')
                : (isEnglish ? 'Generate Now' : '立即生成')}
            </button>
          </div>
        ) : (
          /* ── Medical Report ── */
          <div ref={printRef} className="space-y-4">

            {/* Report Header Card — Medical Style */}
            <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
              {/* Top accent bar */}
              <div className="h-1.5 w-full" style={{ backgroundColor: sc.color }} />

              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Shield size={16} className="text-primary" />
                      <span className="text-xs font-semibold text-primary uppercase tracking-wide">
                        Guardian Health System
                      </span>
                    </div>
                    <h1 className="text-xl font-bold text-foreground">
                      {isEnglish ? 'Daily Health Report' : '每日健康报告'}
                    </h1>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {isEnglish ? 'Active Elderly Companion System · Edge AI' : '独居老人主动陪伴系统 · 边缘 AI'}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                      <Clock size={10} />
                      {report.date}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      {report.dataSource === 'realtime' && (
                        <span className="flex items-center gap-1 text-[10px] bg-emerald-100 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded">
                          <Database size={8} />
                          {isEnglish ? 'Real Data' : '真实数据'}
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-[10px] bg-blue-50 text-blue-600 border border-blue-200 px-1.5 py-0.5 rounded">
                        <Globe size={8} />
                        {report._language === 'en' ? 'EN' : '中文'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Overall Status Banner */}
                <div
                  className="rounded-xl p-4 border flex items-center gap-3"
                  style={{ backgroundColor: sc.bg, borderColor: sc.border }}
                >
                  {sc.icon}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold" style={{ color: sc.color }}>
                        {isEnglish ? 'Overall Status: ' : '总体状态：'}
                        {sc.label}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{sc.desc}</p>
                  </div>
                </div>

                {/* AI Summary */}
                <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Sparkles size={12} className="text-primary" />
                    <span className="text-xs font-semibold text-foreground">
                      {isEnglish ? 'AI Clinical Summary' : 'AI 临床摘要'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{report.summary}</p>
                </div>
              </div>
            </div>

            {/* Vitals Summary — Medical Grid */}
            <div className="bg-white rounded-2xl border border-border shadow-sm p-6">
              <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <Heart size={14} className="text-rose-400" />
                {isEnglish ? 'Physiological Indicators' : '生理指标摘要'}
                {report.vitals.dataPoints > 0 && (
                  <span className="ml-auto text-[10px] text-muted-foreground font-normal flex items-center gap-1">
                    <Cpu size={9} />
                    {isEnglish
                      ? `${report.vitals.dataPoints} samples · Jetson Nano B01`
                      : `${report.vitals.dataPoints} 个采样点 · Jetson Nano B01`}
                  </span>
                )}
              </h3>

              <div className="grid grid-cols-5 gap-3 mb-4">
                {[
                  {
                    label: isEnglish ? 'Avg HR' : '平均心率',
                    value: report.vitals.avgHR || '--',
                    unit: 'bpm',
                    color: '#ef4444',
                    bg: '#fef2f2',
                    normal: isEnglish ? 'Normal: 60–100' : '正常: 60–100',
                    icon: <Heart size={14} />,
                  },
                  {
                    label: isEnglish ? 'Avg Resp' : '平均呼吸率',
                    value: report.vitals.avgResp || '--',
                    unit: '/min',
                    color: '#3b82f6',
                    bg: '#eff6ff',
                    normal: isEnglish ? 'Normal: 12–20' : '正常: 12–20',
                    icon: <Activity size={14} />,
                  },
                  {
                    label: isEnglish ? 'Avg BVI' : '平均活力指数',
                    value: report.vitals.avgBVI || '--',
                    unit: '/100',
                    color: '#f59e0b',
                    bg: '#fffbeb',
                    normal: isEnglish ? 'Active: ≥70' : '活跃: ≥70',
                    icon: <TrendingUp size={14} />,
                  },
                  {
                    label: isEnglish ? 'Avg SpO₂' : '平均血氧',
                    value: report.vitals.avgSpo2 || '--',
                    unit: '%',
                    color: '#10b981',
                    bg: '#f0fdf4',
                    normal: isEnglish ? 'Normal: ≥95%' : '正常: ≥95%',
                    icon: <Shield size={14} />,
                  },
                  {
                    label: isEnglish ? 'Peak Movement' : '峰值体动',
                    value: report.vitals.peakMovement?.toFixed(1) || '--',
                    unit: '/10',
                    color: '#8b5cf6',
                    bg: '#f5f3ff',
                    normal: isEnglish ? 'Active: >1.5' : '活跃: >1.5',
                    icon: <Activity size={14} />,
                  },
                ].map(item => (
                  <div
                    key={item.label}
                    className="rounded-xl p-4 border text-center"
                    style={{ backgroundColor: item.bg, borderColor: `${item.color}30` }}
                  >
                    <div className="flex justify-center mb-2" style={{ color: item.color }}>
                      {item.icon}
                    </div>
                    <div className="flex items-baseline justify-center gap-0.5">
                      <span className="text-2xl font-bold font-mono" style={{ color: item.color }}>
                        {item.value}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{item.unit}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-1">{item.label}</div>
                    <div className="text-[9px] mt-0.5" style={{ color: `${item.color}99` }}>{item.normal}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Alerts + Conversations Row */}
            <div className="grid grid-cols-2 gap-4">
              {/* Alert Summary */}
              <div className="bg-white rounded-2xl border border-border shadow-sm p-5">
                <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Bell size={14} className="text-amber-400" />
                  {isEnglish ? 'Alert Summary' : '报警摘要'}
                  <span className="ml-auto text-xs font-mono text-muted-foreground">
                    {report.alertCount.total} {isEnglish ? 'total' : '条'}
                  </span>
                </h3>
                <div className="space-y-2">
                  {[
                    { label: isEnglish ? 'Critical' : '严重', count: report.alertCount.critical, color: '#ef4444', bg: '#fef2f2', border: '#fecaca' },
                    { label: isEnglish ? 'Warning' : '警告', count: report.alertCount.warning, color: '#f59e0b', bg: '#fffbeb', border: '#fde68a' },
                    { label: isEnglish ? 'Info' : '信息', count: report.alertCount.info, color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe' },
                  ].map(item => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between rounded-lg px-3 py-2 border"
                      style={{ backgroundColor: item.bg, borderColor: item.border }}
                    >
                      <span className="text-xs font-medium" style={{ color: item.color }}>{item.label}</span>
                      <span className="text-lg font-bold font-mono" style={{ color: item.color }}>{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Conversation Summary */}
              <div className="bg-white rounded-2xl border border-border shadow-sm p-5">
                <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                  <MessageSquare size={14} className="text-primary" />
                  {isEnglish ? 'AI Companion Activity' : 'AI 陪伴活动'}
                </h3>
                <div className="flex items-center justify-center h-24">
                  <div className="text-center">
                    <div className="text-4xl font-bold font-mono text-primary">{report.conversationCount}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {isEnglish ? 'AI conversations today' : '今日 AI 对话次数'}
                    </div>
                    <div className="flex items-center gap-1.5 mt-3 text-[10px] text-muted-foreground justify-center">
                      <User size={10} />
                      <span>{isEnglish ? 'Qwen-Turbo · Edge-TTS' : 'Qwen-Turbo · Edge-TTS 语音'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* AI Recommendations */}
            {report.recommendations?.length > 0 && (
              <div className="bg-white rounded-2xl border border-border shadow-sm p-6">
                <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Sparkles size={14} className="text-primary" />
                  {isEnglish ? 'AI Health Recommendations' : 'AI 健康建议'}
                </h3>
                <div className="space-y-3">
                  {report.recommendations.map((rec: string, i: number) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <ChevronRight size={12} className="text-primary" />
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed flex-1">{rec}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Report Footer */}
            <div className="bg-white rounded-2xl border border-border shadow-sm p-4">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <Shield size={9} className="text-primary" />
                    Guardian AI v3.0
                  </span>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <Cpu size={9} />
                    NVIDIA Jetson Nano B01
                  </span>
                  <span>·</span>
                  <span>STM32F103C6T6</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <Sparkles size={9} className="text-primary" />
                    {isEnglish ? 'Generated by Qwen-Turbo' : 'Qwen-Turbo 生成'}
                  </span>
                  <span>·</span>
                  <span>{report.date}</span>
                </div>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
