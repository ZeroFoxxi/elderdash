// LiveMonitor.tsx - Real-time physiological data display
// Data source: WebSocket /ws/live (Jetson pushes via HTTP API → server broadcasts)

import { Heart, Wind, Activity, Zap, GitMerge, Wifi, WifiOff } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useDashboard } from '../contexts/DashboardContext';

function displayPpgHr(ppgHr: number | undefined): string {
  if (ppgHr === undefined || ppgHr === null || ppgHr === 0) return '--';
  return String(Math.round(ppgHr));
}

function getHrStatus(hr: number | undefined, isEnglish: boolean) {
  if (!hr) return { label: isEnglish ? 'Waiting' : '等待数据', color: 'text-muted-foreground' };
  if (hr < 50) return { label: isEnglish ? 'Low' : '偏低', color: 'text-blue-500' };
  if (hr > 100) return { label: isEnglish ? 'High' : '偏高', color: 'text-red-500' };
  return { label: isEnglish ? 'Normal' : '正常', color: 'text-emerald-500' };
}

function getRespStatus(resp: number | undefined, isEnglish: boolean) {
  if (!resp) return { label: isEnglish ? 'Waiting' : '等待数据', color: 'text-muted-foreground' };
  if (resp < 12 || resp > 20) return { label: isEnglish ? 'Abnormal' : '异常', color: 'text-amber-500' };
  return { label: isEnglish ? 'Normal' : '正常', color: 'text-emerald-500' };
}

function getMovementStatus(movement: number | undefined, isEnglish: boolean) {
  if (movement === undefined) return { label: isEnglish ? 'Waiting' : '等待数据', color: 'text-muted-foreground' };
  if (movement < 1.5) return { label: isEnglish ? 'Still' : '静止', color: 'text-blue-400' };
  if (movement > 5) return { label: isEnglish ? 'Active' : '活跃', color: 'text-emerald-500' };
  return { label: isEnglish ? 'Normal Activity' : '正常活动', color: 'text-teal-500' };
}

function getBviStatus(bvi: number | undefined, isEnglish: boolean) {
  if (bvi === undefined) return { label: isEnglish ? 'Waiting' : '等待数据', color: 'text-muted-foreground' };
  if (bvi >= 70) return { label: isEnglish ? 'Active' : '活跃', color: 'text-emerald-500' };
  if (bvi >= 50) return { label: isEnglish ? 'Good' : '良好', color: 'text-teal-500' };
  if (bvi >= 30) return { label: isEnglish ? 'Moderate' : '一般', color: 'text-amber-500' };
  return { label: isEnglish ? 'Low' : '偏低', color: 'text-red-500' };
}

function getFusionRuleLabel(rule: string | undefined, isEnglish: boolean): string {
  if (!rule) return isEnglish ? 'No data' : '无数据';
  const labels: Record<string, string> = {
    RULE1: 'Radar only (no PPG)',
    RULE2: 'Radar only (PPG anomaly)',
    RULE3: 'Radar only (PPG warming)',
    RULE4: '60% Radar + 40% PPG',
  };
  return labels[rule] ?? rule;
}

export default function LiveMonitor() {
  const {
    vitals, vitalsHistory, isEnglish, isDemoMode, dataSource, realtimeConnected,
  } = useDashboard();

  const hrStatus = getHrStatus(vitals?.heartRate, isEnglish);
  const respStatus = getRespStatus(vitals?.respRate, isEnglish);
  const movStatus = getMovementStatus(vitals?.movement, isEnglish);
  const bviStatus = getBviStatus(vitals?.bvi, isEnglish);

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

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-4">
      {/* Realtime Connection Banner */}
      {dataSource === 'realtime' && (
        <div
          className="rounded-xl border px-4 py-2.5 flex items-center gap-3"
          style={{ borderColor: realtimeConnected ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)', backgroundColor: realtimeConnected ? 'rgba(16,185,129,0.05)' : 'rgba(239,68,68,0.05)' }}
        >
          {realtimeConnected
            ? <Wifi size={13} className="text-emerald-500" />
            : <WifiOff size={13} className="text-red-400" />}
          <span className="text-xs font-semibold" style={{ color: realtimeConnected ? '#10b981' : '#ef4444' }}>
            {realtimeConnected
              ? (isEnglish ? '● Jetson Connected — Receiving real-time data' : '● Jetson 已连接 — 正在接收实时数据')
              : (isEnglish ? '○ Waiting for Jetson data... Run the Python script on Jetson Nano' : '○ 等待 Jetson 数据... 请在 Jetson Nano 上运行 Python 脚本')}
          </span>
        </div>
      )}

      {/* Page Header */}
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

      {/* 4 Vital Cards */}
      <div className="grid grid-cols-4 gap-3">
        {/* Heart Rate */}
        <div className="bg-white rounded-xl p-4 border border-border shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <Heart size={15} className="text-rose-400 heartbeat" />
            <span className={`text-[11px] font-semibold ${hrStatus.color}`}>{hrStatus.label}</span>
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
            <span className={`text-[11px] font-semibold ${respStatus.color}`}>{respStatus.label}</span>
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
            <span className={`text-[11px] font-semibold ${movStatus.color}`}>{movStatus.label}</span>
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
            <span className={`text-[11px] font-semibold ${bviStatus.color}`}>{bviStatus.label}</span>
          </div>
          <div className="flex items-baseline gap-1 mb-1">
            <span className="text-3xl font-bold text-foreground" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
              {waiting ? '--' : Math.round(vitals?.bvi ?? 0)}
            </span>
            <span className="text-sm text-muted-foreground">BVI</span>
          </div>
          <div className="text-xs text-muted-foreground">{isEnglish ? 'Vitality Index' : '活力指数 Vitality Index'}</div>
          <div className="text-[10px] text-muted-foreground/60 mt-0.5">Active</div>
        </div>
      </div>

      {/* Waveform + Fusion Algorithm */}
      <div className="grid grid-cols-3 gap-4">
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
          <div style={{ height: 140 }}>
            {displayChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={displayChartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 9, fill: '#94a3b8' }}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
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
          <div className="text-center py-3">
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
                <span className="text-muted-foreground">PPG Sensor (STM32)</span>
              </span>
              <span className="font-mono font-semibold text-foreground">
                {displayPpgHr(vitals?.ppgHr)} bpm
              </span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-border">
            <div className="text-[10px] text-muted-foreground">
              Method: {getFusionRuleLabel(vitals?.fusedMethod, isEnglish)}
            </div>
          </div>
        </div>
      </div>

      {/* Target ID + PPG Sensor */}
      <div className="grid grid-cols-2 gap-4">
        {/* Target ID */}
        <div className="bg-white rounded-xl p-4 border border-border shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <Activity size={13} className="text-teal-500" />
              <h3 className="text-sm font-semibold text-foreground">{isEnglish ? 'Target ID' : '目标识别'}</h3>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-teal-50 text-teal-600 font-semibold border border-teal-100">CA1</span>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-emerald-50 text-emerald-600">
              {vitals?.targetId === 'None' || !vitals?.targetId ? (isEnglish ? 'No Target' : '无目标') : '● Human'}
            </span>
          </div>
          <div className="space-y-1.5 text-[11px]">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{isEnglish ? 'Result' : 'Result'}</span>
              <span className="font-semibold text-foreground">{vitals?.targetId ?? '--'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Timestamp</span>
              <span className="font-mono text-teal-500">{new Date().toLocaleTimeString('en-US', { hour12: false })}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">TTS Mode</span>
              <span className="text-emerald-500">● Voice Alert Active</span>
            </div>
          </div>
        </div>

        {/* PPG Sensor */}
        <div className="bg-white rounded-xl p-4 border border-border shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <Heart size={13} className="text-pink-400" />
              <h3 className="text-sm font-semibold text-foreground">{isEnglish ? 'PPG Sensor' : 'PPG 传感器'}</h3>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-50 text-slate-500 font-semibold border border-slate-100">STM32</span>
            </div>
            <span
              className="text-[10px] font-semibold"
              style={{ color: vitals?.ppgConnected ? '#10b981' : '#94a3b8' }}
            >
              {vitals?.ppgConnected ? (isEnglish ? 'Connected' : '已连接') : (isEnglish ? 'Disconnected' : '未连接')}
            </span>
          </div>
          <div className="space-y-2 text-[11px]">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">PPG Heart Rate</span>
              <span className="font-mono font-bold text-foreground">
                {displayPpgHr(vitals?.ppgHr)} bpm
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">SpO₂</span>
              <span className="font-mono font-bold" style={{ color: (vitals?.ppgSpo2 ?? 0) < 95 ? '#ef4444' : '#10b981' }}>
                {vitals?.ppgSpo2 ? `${vitals.ppgSpo2}%` : '--'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Signal Quality</span>
              <div className="flex items-center gap-2">
                <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${vitals?.ppgSignalQuality ?? 0}%`,
                      backgroundColor: (vitals?.ppgSignalQuality ?? 0) > 60 ? '#10b981' : '#ef4444',
                    }}
                  />
                </div>
                <span className="font-mono text-xs">{vitals?.ppgSignalQuality ?? 0}%</span>
              </div>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-border text-[9px] text-muted-foreground">
            Normal: SpO₂ ≥ 95%, HR 60-100 bpm
          </div>
        </div>
      </div>
    </div>
  );
}
