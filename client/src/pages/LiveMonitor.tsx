// LiveMonitor.tsx — Real-time physiological monitoring dashboard
// Layout: Sensor-balanced (Radar + PPG equal prominence) + Agent Status Card

import { useState, useEffect, useRef } from 'react';
import { Heart, Wind, Activity, Zap, GitMerge, Wifi, WifiOff, Bot, Timer, Brain, Radio, Droplets, CheckCircle2, Circle, Loader2 } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useDashboard } from '../contexts/DashboardContext';

// ─── Status helpers ────────────────────────────────────────────────────────────

function displayVal(val: number | undefined, decimals = 0): string {
  if (val === undefined || val === null) return '--';
  return decimals > 0 ? val.toFixed(decimals) : String(Math.round(val));
}

function getHrStatus(hr: number | undefined, isEnglish: boolean) {
  if (!hr) return { label: isEnglish ? 'Waiting' : '等待数据', color: 'text-muted-foreground', bg: 'bg-muted/50' };
  if (hr < 50) return { label: isEnglish ? 'Low' : '偏低', color: 'text-blue-500', bg: 'bg-blue-50' };
  if (hr > 100) return { label: isEnglish ? 'High' : '偏高', color: 'text-red-500', bg: 'bg-red-50' };
  return { label: isEnglish ? 'Normal' : '正常', color: 'text-emerald-500', bg: 'bg-emerald-50' };
}

function getRespStatus(resp: number | undefined, isEnglish: boolean) {
  if (!resp) return { label: isEnglish ? 'Waiting' : '等待数据', color: 'text-muted-foreground', bg: 'bg-muted/50' };
  if (resp < 12 || resp > 20) return { label: isEnglish ? 'Abnormal' : '异常', color: 'text-amber-500', bg: 'bg-amber-50' };
  return { label: isEnglish ? 'Normal' : '正常', color: 'text-emerald-500', bg: 'bg-emerald-50' };
}

function getMovementStatus(movement: number | undefined, isEnglish: boolean) {
  if (movement === undefined) return { label: isEnglish ? 'Waiting' : '等待数据', color: 'text-muted-foreground', bg: 'bg-muted/50' };
  if (movement < 1.5) return { label: isEnglish ? 'Still' : '静止', color: 'text-blue-400', bg: 'bg-blue-50' };
  if (movement > 5) return { label: isEnglish ? 'Active' : '活跃', color: 'text-emerald-500', bg: 'bg-emerald-50' };
  return { label: isEnglish ? 'Normal' : '正常活动', color: 'text-teal-500', bg: 'bg-teal-50' };
}

function getBviStatus(bvi: number | undefined, isEnglish: boolean) {
  if (bvi === undefined) return { label: isEnglish ? 'Waiting' : '等待数据', color: 'text-muted-foreground', bg: 'bg-muted/50' };
  if (bvi >= 70) return { label: isEnglish ? 'Active' : '活跃', color: 'text-emerald-500', bg: 'bg-emerald-50' };
  if (bvi >= 50) return { label: isEnglish ? 'Good' : '良好', color: 'text-teal-500', bg: 'bg-teal-50' };
  if (bvi >= 30) return { label: isEnglish ? 'Moderate' : '一般', color: 'text-amber-500', bg: 'bg-amber-50' };
  return { label: isEnglish ? 'Low' : '偏低', color: 'text-red-500', bg: 'bg-red-50' };
}

function getSpo2Status(spo2: number | undefined, isEnglish: boolean) {
  if (!spo2) return { label: '--', color: 'text-muted-foreground' };
  if (spo2 < 90) return { label: isEnglish ? 'Critical' : '危险', color: 'text-red-500' };
  if (spo2 < 95) return { label: isEnglish ? 'Low' : '偏低', color: 'text-amber-500' };
  return { label: isEnglish ? 'Normal' : '正常', color: 'text-emerald-500' };
}

function getFusionRuleLabel(rule: string | undefined, isEnglish: boolean): string {
  if (!rule) return isEnglish ? 'No data' : '无数据';
  const labels: Record<string, [string, string]> = {
    RULE1: ['Radar only (no PPG)', '仅雷达（无PPG）'],
    RULE2: ['Radar only (PPG anomaly)', '仅雷达（PPG异常）'],
    RULE3: ['Radar only (PPG warming)', '仅雷达（PPG预热）'],
    RULE4: ['60% Radar + 40% PPG', '60% 雷达 + 40% PPG'],
  };
  const pair = labels[rule];
  if (!pair) return rule;
  return isEnglish ? pair[0] : pair[1];
}

// ─── Agent Phase Engine ────────────────────────────────────────────────────────

type AgentPhase = 'monitoring' | 'analyzing' | 'triggering' | 'conversing' | 'reporting';

function getAgentPhase(bvi: number | undefined, lastInteractionMins: number): {
  phase: AgentPhase;
  label_zh: string;
  label_en: string;
  color: string;
  icon: React.ReactNode;
  nextPatrolMins: number;
} {
  if (bvi !== undefined && bvi < 40) {
    return {
      phase: 'triggering',
      label_zh: '主动触发 — BVI 偏低',
      label_en: 'Proactive Trigger — Low BVI',
      color: 'text-amber-500',
      icon: <Brain size={13} className="text-amber-500" />,
      nextPatrolMins: 0,
    };
  }
  if (lastInteractionMins >= 55) {
    return {
      phase: 'triggering',
      label_zh: '即将主动巡检',
      label_en: 'Patrol Imminent',
      color: 'text-orange-500',
      icon: <Timer size={13} className="text-orange-500" />,
      nextPatrolMins: 60 - lastInteractionMins,
    };
  }
  if (lastInteractionMins >= 45) {
    return {
      phase: 'analyzing',
      label_zh: '分析行为模式',
      label_en: 'Analyzing Behavior',
      color: 'text-blue-500',
      icon: <Brain size={13} className="text-blue-500" />,
      nextPatrolMins: 60 - lastInteractionMins,
    };
  }
  return {
    phase: 'monitoring',
    label_zh: '持续监测中',
    label_en: 'Continuous Monitoring',
    color: 'text-emerald-500',
    icon: <Radio size={13} className="text-emerald-500" />,
    nextPatrolMins: 60 - lastInteractionMins,
  };
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function LiveMonitor() {
  const {
    vitals, vitalsHistory, isEnglish, isDemoMode, dataSource, realtimeConnected,
    bviLoopPhase, demoScenario,
  } = useDashboard();

  // Map bviLoopPhase to AgentPhase for demo mode
  const demoAgentPhaseMap: Record<string, { phase: AgentPhase; label_zh: string; label_en: string; color: string; icon: React.ReactNode; nextPatrolMins: number }> = {
    active:           { phase: 'monitoring',  label_zh: '持续监测中 — BVI 正常',  label_en: 'Monitoring — BVI Normal',      color: 'text-emerald-500', icon: <Radio size={13} className="text-emerald-500" />, nextPatrolMins: 48 },
    declining:        { phase: 'analyzing',   label_zh: '分析行为模式 — BVI 下降', label_en: 'Analyzing — BVI Declining',    color: 'text-amber-500',   icon: <Brain size={13} className="text-amber-500" />,  nextPatrolMins: 8  },
    patrol_triggered: { phase: 'triggering',  label_zh: '主动触发 — BVI 极低',    label_en: 'Proactive Trigger — Low BVI', color: 'text-red-500',     icon: <Brain size={13} className="text-red-500" />,    nextPatrolMins: 0  },
    ai_conversing:    { phase: 'conversing',  label_zh: 'AI 对话陪伴中',           label_en: 'AI Companion Active',         color: 'text-indigo-500',  icon: <Bot size={13} className="text-indigo-500" />,   nextPatrolMins: 0  },
    recovering:       { phase: 'monitoring',  label_zh: 'BVI 恢复中',              label_en: 'BVI Recovering',              color: 'text-teal-500',    icon: <Radio size={13} className="text-teal-500" />,   nextPatrolMins: 55 },
    stable:           { phase: 'monitoring',  label_zh: '已恢复稳定',              label_en: 'Stable — Recovered',          color: 'text-emerald-500', icon: <Radio size={13} className="text-emerald-500" />, nextPatrolMins: 60 },
  };

  // Simulated last interaction timer (resets when vitals update, counts up)
  const [lastInteractionMins, setLastInteractionMins] = useState(12);
  const interactionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastVitalsRef = useRef(vitals);

  useEffect(() => {
    if (vitals !== lastVitalsRef.current) {
      lastVitalsRef.current = vitals;
      // Simulate interaction reset when new data arrives with activity
      if (vitals && vitals.movement > 2) {
        setLastInteractionMins(prev => Math.max(0, prev - 3));
      }
    }
  }, [vitals]);

  useEffect(() => {
    interactionTimerRef.current = setInterval(() => {
      setLastInteractionMins(prev => (prev >= 60 ? 0 : prev + 1));
    }, 60000);
    return () => { if (interactionTimerRef.current) clearInterval(interactionTimerRef.current); };
  }, []);

  const hrStatus = getHrStatus(vitals?.heartRate, isEnglish);
  const respStatus = getRespStatus(vitals?.respRate, isEnglish);
  const movStatus = getMovementStatus(vitals?.movement, isEnglish);
  const bviStatus = getBviStatus(vitals?.bvi, isEnglish);
  const spo2Status = getSpo2Status(vitals?.ppgSpo2, isEnglish);

  // In bvi_loop demo scenario, use the actual loop phase for accurate Agent status
  const agentInfo = (isDemoMode && demoScenario === 'bvi_loop')
    ? (demoAgentPhaseMap[bviLoopPhase] ?? demoAgentPhaseMap.active)
    : getAgentPhase(vitals?.bvi, lastInteractionMins);

  const chartData = vitalsHistory.map((v, i) => ({
    time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
    hr: v.heartRate,
    resp: v.respRate,
    index: i,
  }));
  const displayChartData = chartData.length > 0 ? chartData : (
    vitals ? [{ time: '--:--:--', hr: vitals.heartRate, resp: vitals.respRate, index: 0 }] : []
  );

  const waiting = !vitals;
  const ppgActive = !!(vitals?.ppgConnected || (vitals?.ppgHr && vitals.ppgHr > 0));

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-4">

      {/* ── Realtime Connection Banner ─────────────────────────────────────── */}
      {dataSource === 'realtime' && (() => {
        const isLive = realtimeConnected || !!vitals;
        return (
          <div
            className="rounded-xl border px-4 py-2.5 flex items-center gap-3"
            style={{
              borderColor: isLive ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)',
              backgroundColor: isLive ? 'rgba(16,185,129,0.05)' : 'rgba(239,68,68,0.05)',
            }}
          >
            {isLive ? <Wifi size={13} className="text-emerald-500" /> : <WifiOff size={13} className="text-red-400" />}
            <span className="text-xs font-semibold" style={{ color: isLive ? '#10b981' : '#ef4444' }}>
              {isLive
                ? (isEnglish ? '● Jetson Connected — Receiving real-time data' : '● Jetson 已连接 — 正在接收实时数据')
                : (isEnglish ? '○ Waiting for Jetson data... Run jetson_push_data.py on Jetson Nano (URL: elderdash-ky9k6ssp.manus.space)' : '○ 等待 Jetson 数据... 请在 Jetson Nano 上运行 jetson_push_data.py（目标：elderdash-ky9k6ssp.manus.space）')}
            </span>
          </div>
        );
      })()}

      {/* ── Page Header ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-baseline gap-2">
            <h2 className="text-lg font-bold text-foreground">
              {isEnglish ? 'Live Vitals Monitor' : '实时生理监控'}
            </h2>
            <span className="text-xs text-muted-foreground font-normal">Live Vitals Monitor</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {isEnglish
              ? 'Data Source: R60ABD1 mmWave Radar + DFRobot PPG Sensor (STM32)'
              : '数据来源 Data Source: R60ABD1 毫米波雷达 Radar + DFRobot PPG 传感器 Sensor'}
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: isDemoMode ? '#f59e0b' : '#10b981' }}>
          <div className="w-1.5 h-1.5 rounded-full live-dot" style={{ backgroundColor: isDemoMode ? '#f59e0b' : '#10b981' }} />
          {isDemoMode ? (isEnglish ? '· Demo' : '· 演示') : (isEnglish ? '· Live' : '· 实时')}
        </div>
      </div>

      {/* ── Row 1: 4 Vital Cards ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Heart Rate */}
        <div className="bg-white rounded-xl p-4 border border-border shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <Heart size={15} className="text-rose-400 heartbeat" />
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${hrStatus.color} ${hrStatus.bg}`}>{hrStatus.label}</span>
          </div>
          <div className="flex items-baseline gap-1 mb-1">
            <span className="text-3xl font-bold text-foreground" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
              {waiting ? '--' : Math.round(vitals?.heartRate ?? 0)}
            </span>
            <span className="text-sm text-muted-foreground">bpm</span>
          </div>
          <div className="text-xs text-muted-foreground">{isEnglish ? 'Heart Rate' : '心率 Heart Rate'}</div>
          <div className="text-[10px] text-muted-foreground/60 mt-0.5">Normal (60-100 bpm)</div>
        </div>

        {/* Resp Rate */}
        <div className="bg-white rounded-xl p-4 border border-border shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <Wind size={15} className="text-sky-400" />
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${respStatus.color} ${respStatus.bg}`}>{respStatus.label}</span>
          </div>
          <div className="flex items-baseline gap-1 mb-1">
            <span className="text-3xl font-bold text-foreground" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
              {waiting ? '--' : Math.round(vitals?.respRate ?? 0)}
            </span>
            <span className="text-sm text-muted-foreground">/min</span>
          </div>
          <div className="text-xs text-muted-foreground">{isEnglish ? 'Resp. Rate' : '呼吸率 Resp. Rate'}</div>
          <div className="text-[10px] text-muted-foreground/60 mt-0.5">Normal (12-20 /min)</div>
        </div>

        {/* Movement */}
        <div className="bg-white rounded-xl p-4 border border-border shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <Activity size={15} className="text-violet-400" />
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${movStatus.color} ${movStatus.bg}`}>{movStatus.label}</span>
          </div>
          <div className="flex items-baseline gap-1 mb-1">
            <span className="text-3xl font-bold text-foreground" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
              {waiting ? '--' : (vitals?.movement?.toFixed(1) ?? '--')}
            </span>
            <span className="text-sm text-muted-foreground">/10</span>
          </div>
          <div className="text-xs text-muted-foreground">{isEnglish ? 'Movement' : '体动强度 Movement'}</div>
          <div className="text-[10px] text-muted-foreground/60 mt-0.5">Normal Activity</div>
        </div>

        {/* BVI */}
        <div className="bg-white rounded-xl p-4 border border-border shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <Zap size={15} className="text-amber-400" />
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${bviStatus.color} ${bviStatus.bg}`}>{bviStatus.label}</span>
          </div>
          <div className="flex items-baseline gap-1 mb-1">
            <span className="text-3xl font-bold text-foreground" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
              {waiting ? '--' : Math.round(vitals?.bvi ?? 0)}
            </span>
            <span className="text-sm text-muted-foreground">BVI</span>
          </div>
          <div className="text-xs text-muted-foreground">{isEnglish ? 'Vitality Index' : '活力指数 Vitality Index'}</div>
          <div className="text-[10px] text-muted-foreground/60 mt-0.5">Active ≥ 70 · Good ≥ 50</div>
        </div>
      </div>

      {/* ── Row 2: Waveform + Fusion Algorithm ───────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* HR/Resp Waveform */}
        <div className="col-span-2 bg-white rounded-xl p-4 border border-border shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="flex items-baseline gap-2">
                <h3 className="text-sm font-semibold text-foreground">
                  {isEnglish ? 'HR / Resp Waveform' : '心率 / 呼吸率实时波形'}
                </h3>
                <span className="text-[10px] text-muted-foreground">HR / Resp Waveform</span>
              </div>
              <p className="text-[10px] text-muted-foreground">{isEnglish ? 'Last 60 seconds' : '最近 60 秒数据'}</p>
            </div>
            <div className="flex items-center gap-3 text-[10px]">
              <span className="flex items-center gap-1">
                <span className="w-3 h-0.5 bg-rose-400 inline-block rounded" />
                <span className="text-rose-400 font-mono font-semibold">
                  {waiting ? '--' : Math.round(vitals?.heartRate ?? 0)} bpm
                </span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-0.5 bg-emerald-400 inline-block rounded" />
                <span className="text-emerald-400 font-mono font-semibold">
                  {waiting ? '--' : Math.round(vitals?.respRate ?? 0)} /min
                </span>
              </span>
            </div>
          </div>
          <div style={{ height: 130 }}>
            {displayChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={displayChartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                  <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{ fontSize: 10, borderRadius: 8, border: '1px solid #e2e8f0' }}
                    formatter={(val: number, name: string) => [
                      `${Math.round(val)} ${name === 'hr' ? 'bpm' : '/min'}`,
                      name === 'hr' ? 'Heart Rate' : 'Resp Rate',
                    ]}
                  />
                  <Line type="monotone" dataKey="hr" stroke="#f87171" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="resp" stroke="#34d399" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                {isEnglish ? 'Waiting for data...' : '等待数据...'}
              </div>
            )}
          </div>
          <div className="flex items-center gap-4 mt-2 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-rose-400 inline-block" /> {isEnglish ? 'Heart Rate HR' : '心率 HR'}</span>
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-emerald-400 inline-block" /> {isEnglish ? 'Resp Rate' : '呼吸率 Resp'}</span>
          </div>
        </div>

        {/* Fused HR Algorithm */}
        <div className="bg-white rounded-xl p-4 border border-border shadow-sm">
          <div className="flex items-center gap-1.5 mb-3">
            <GitMerge size={13} className="text-teal-500" />
            <h3 className="text-sm font-semibold text-foreground">{isEnglish ? 'Fused HR Algorithm' : '融合心率算法'}</h3>
          </div>
          <div className="text-center py-2">
            <div className="text-4xl font-bold text-teal-500" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
              {waiting ? '--' : Math.round(vitals?.fusedHr ?? vitals?.heartRate ?? 0)}
            </div>
            <div className="text-[10px] text-muted-foreground mt-1">bpm · {isEnglish ? 'Fused Result' : '融合结果'}</div>
          </div>
          <div className="space-y-2 mt-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-400 inline-block" />
                <span className="text-muted-foreground">Radar (R60ABD1)</span>
              </span>
              <span className="font-mono font-semibold text-foreground">
                {waiting ? '--' : Math.round(vitals?.radarHr ?? 0)} bpm
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-pink-400 inline-block" />
                <span className="text-muted-foreground">PPG (STM32)</span>
              </span>
              <span className="font-mono font-semibold text-foreground">
                {(vitals?.ppgHr && vitals.ppgHr > 0) ? `${Math.round(vitals.ppgHr)} bpm` : '--'}
              </span>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-border">
            <div className="text-[10px] text-muted-foreground">
              {isEnglish ? 'Method: ' : '方法：'}{getFusionRuleLabel(vitals?.fusedMethod, isEnglish)}
            </div>
          </div>
        </div>
      </div>

      {/* ── Row 3: Radar Sensor | PPG Sensor | Agent Status ──────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Radar Sensor Card */}
        <div className="bg-white rounded-xl p-4 border border-border shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <Radio size={13} className="text-teal-500" />
              <h3 className="text-sm font-semibold text-foreground">{isEnglish ? 'Radar Sensor' : '雷达传感器'}</h3>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-teal-50 text-teal-600 font-semibold border border-teal-100">R60ABD1</span>
            </div>
            <span className="text-[10px] font-semibold text-emerald-500">
              {isEnglish ? '● Active' : '● 运行中'}
            </span>
          </div>
          <div className="space-y-2.5 text-[11px]">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">{isEnglish ? 'Heart Rate' : '心率'}</span>
              <span className="font-mono font-bold text-foreground">{waiting ? '--' : Math.round(vitals?.radarHr ?? 0)} bpm</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">{isEnglish ? 'Resp. Rate' : '呼吸率'}</span>
              <span className="font-mono font-bold text-foreground">{waiting ? '--' : Math.round(vitals?.respRate ?? 0)} /min</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">{isEnglish ? 'Movement' : '体动强度'}</span>
              <span className={`font-mono font-bold ${movStatus.color}`}>
                {waiting ? '--' : (vitals?.movement?.toFixed(1) ?? '--')} /10
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">{isEnglish ? 'Target ID' : '目标识别'}</span>
              <span className={`font-semibold text-[10px] px-1.5 py-0.5 rounded-full ${
                vitals?.targetId && vitals.targetId !== 'None'
                  ? 'text-emerald-600 bg-emerald-50'
                  : 'text-muted-foreground bg-muted/50'
              }`}>
                {vitals?.targetId && vitals.targetId !== 'None' ? '● Human' : (isEnglish ? 'No Target' : '无目标')}
              </span>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-border text-[9px] text-muted-foreground">
            {isEnglish ? 'mmWave 60GHz · CA1 Algorithm' : '毫米波 60GHz · CA1 算法'}
          </div>
        </div>

        {/* PPG Sensor Card — equal prominence */}
        <div className={`bg-white rounded-xl p-4 border shadow-sm transition-all ${ppgActive ? 'border-pink-200 shadow-pink-50' : 'border-border'}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <Droplets size={13} className="text-pink-400" />
              <h3 className="text-sm font-semibold text-foreground">{isEnglish ? 'PPG Sensor' : 'PPG 传感器'}</h3>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-pink-50 text-pink-600 font-semibold border border-pink-100">STM32</span>
            </div>
            <span
              className="text-[10px] font-semibold"
              style={{ color: ppgActive ? '#10b981' : '#94a3b8' }}
            >
              {ppgActive ? (isEnglish ? '● Connected' : '● 已连接') : (isEnglish ? '○ Standby' : '○ 待机')}
            </span>
          </div>
          <div className="space-y-2.5 text-[11px]">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">{isEnglish ? 'PPG Heart Rate' : 'PPG 心率'}</span>
              <span className="font-mono font-bold text-foreground">
                {(vitals?.ppgHr && vitals.ppgHr > 0) ? `${Math.round(vitals.ppgHr)} bpm` : '--'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">SpO₂</span>
              <span className={`font-mono font-bold ${spo2Status.color}`}>
                {vitals?.ppgSpo2 ? `${vitals.ppgSpo2}%` : '--'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">{isEnglish ? 'Signal Quality' : '信号质量'}</span>
              <div className="flex items-center gap-2">
                <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${vitals?.ppgSignalQuality ?? 0}%`,
                      backgroundColor: (vitals?.ppgSignalQuality ?? 0) > 60 ? '#10b981' : '#ef4444',
                    }}
                  />
                </div>
                <span className="font-mono text-xs">{vitals?.ppgSignalQuality ?? 0}%</span>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">{isEnglish ? 'SpO₂ Status' : '血氧状态'}</span>
              <span className={`font-semibold text-[10px] ${spo2Status.color}`}>{spo2Status.label}</span>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-border text-[9px] text-muted-foreground">
            {isEnglish ? 'DFRobot · Normal: SpO₂ ≥ 95%, HR 60-100 bpm' : 'DFRobot · 正常：SpO₂ ≥ 95%，HR 60-100 bpm'}
          </div>
        </div>

        {/* Agent Status Card */}
        <div className="bg-white rounded-xl p-4 border border-border shadow-sm">
          <div className="flex items-center gap-1.5 mb-3">
            <Bot size={13} className="text-primary" />
            <h3 className="text-sm font-semibold text-foreground">{isEnglish ? 'Agent Status' : 'Agent 状态'}</h3>
          </div>

          {/* Current phase */}
          <div className="flex items-center gap-2 mb-3 p-2 rounded-lg bg-muted/40">
            {agentInfo.icon}
            <span className={`text-xs font-semibold ${agentInfo.color}`}>
              {isEnglish ? agentInfo.label_en : agentInfo.label_zh}
            </span>
          </div>

          {/* Patrol countdown */}
          <div className="mb-3">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] text-muted-foreground">{isEnglish ? 'Next patrol in' : '下次巡检'}</span>
              <span className="text-[10px] font-mono font-semibold text-primary">
                {agentInfo.nextPatrolMins <= 0
                  ? (isEnglish ? 'Now' : '立即')
                  : `${agentInfo.nextPatrolMins} min`}
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{
                  width: `${Math.min(100, (lastInteractionMins / 60) * 100)}%`,
                  backgroundColor: lastInteractionMins >= 55 ? '#f59e0b' : lastInteractionMins >= 45 ? '#3b82f6' : '#10b981',
                }}
              />
            </div>
            <div className="text-[9px] text-muted-foreground mt-0.5">
              {isEnglish
                ? `${lastInteractionMins}min since last interaction`
                : `距上次互动 ${lastInteractionMins} 分钟`}
            </div>
          </div>

          {/* Mini workflow steps */}
          <div className="space-y-1.5">
            {[
              { label_zh: '传感器采集', label_en: 'Sensor Collection', done: true },
              { label_zh: 'BVI 计算', label_en: 'BVI Calculation', done: true },
              { label_zh: '主动巡检触发', label_en: 'Patrol Trigger', done: agentInfo.phase === 'triggering' || agentInfo.phase === 'conversing', running: agentInfo.phase === 'triggering' },
              { label_zh: 'Qwen AI 生成', label_en: 'Qwen AI Reply', done: agentInfo.phase === 'conversing', running: agentInfo.phase === 'conversing' },
              { label_zh: 'TTS 语音播报', label_en: 'TTS Playback', done: false, running: false },
            ].map((step, i) => (
              <div key={i} className="flex items-center gap-2">
                {step.running ? (
                  <Loader2 size={10} className="text-primary animate-spin flex-shrink-0" />
                ) : step.done ? (
                  <CheckCircle2 size={10} className="text-emerald-500 flex-shrink-0" />
                ) : (
                  <Circle size={10} className="text-muted-foreground/40 flex-shrink-0" />
                )}
                <span className={`text-[10px] ${step.done || step.running ? 'text-foreground' : 'text-muted-foreground/50'}`}>
                  {isEnglish ? step.label_en : step.label_zh}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-3 pt-2 border-t border-border text-[9px] text-muted-foreground">
            LLM: Qwen-Turbo · TTS: Edge-TTS · STT: Whisper
          </div>
        </div>
      </div>
    </div>
  );
}
