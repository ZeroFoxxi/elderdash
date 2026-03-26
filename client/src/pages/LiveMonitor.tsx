// Guardian Dashboard - Live Vitals Monitor Page
// Real-time physiological data display with waveform charts
// Design: Medical-grade dark sidebar + light content, teal accent

import { useState } from 'react';
import { Heart, Wind, Activity, Zap, GitMerge, Wifi, WifiOff, Settings2, ChevronDown, ChevronUp } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useDashboard } from '../contexts/DashboardContext';

// PPG heart rate display: show -- when 0 or no signal
function displayPpgHr(ppgHr: number | undefined): string {
  if (ppgHr === undefined || ppgHr === null || ppgHr === 0) return '--';
  return String(Math.round(ppgHr));
}

function getHrStatus(hr: number | undefined, isEnglish: boolean): { label: string; color: string } {
  if (!hr) return { label: isEnglish ? 'Waiting' : '等待数据', color: 'text-muted-foreground' };
  if (hr < 50) return { label: isEnglish ? 'Low' : '偏低', color: 'text-blue-500' };
  if (hr > 100) return { label: isEnglish ? 'High' : '偏高', color: 'text-red-500' };
  return { label: isEnglish ? 'Normal' : '正常', color: 'text-emerald-500' };
}

function getRespStatus(resp: number | undefined, isEnglish: boolean): { label: string; color: string } {
  if (!resp) return { label: isEnglish ? 'Waiting' : '等待数据', color: 'text-muted-foreground' };
  if (resp < 12 || resp > 20) return { label: isEnglish ? 'Abnormal' : '异常', color: 'text-amber-500' };
  return { label: isEnglish ? 'Normal' : '正常', color: 'text-emerald-500' };
}

function getMovementStatus(movement: number | undefined, isEnglish: boolean): { label: string; color: string } {
  if (movement === undefined) return { label: isEnglish ? 'Waiting' : '等待数据', color: 'text-muted-foreground' };
  if (movement < 1.5) return { label: isEnglish ? 'Still' : '静止', color: 'text-blue-400' };
  if (movement > 5) return { label: isEnglish ? 'Active' : '活跃', color: 'text-emerald-500' };
  return { label: isEnglish ? 'Normal Activity' : '正常活动', color: 'text-teal-500' };
}

function getBviStatus(bvi: number | undefined, isEnglish: boolean): { label: string; color: string } {
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
    vitals, vitalsHistory, isEnglish, isDemoMode,
    dataSource, mqttSettings, setMqttSettings, mqttStatus, mqttError,
    connectMqtt, disconnectMqtt, mqttConnected,
  } = useDashboard();
  const [showMqttConfig, setShowMqttConfig] = useState(false);
  const [localBroker, setLocalBroker] = useState(mqttSettings.brokerUrl);
  const [localTopic, setLocalTopic] = useState(mqttSettings.topic);
  const [localUser, setLocalUser] = useState(mqttSettings.username ?? '');
  const [localPass, setLocalPass] = useState(mqttSettings.password ?? '');

  const hrStatus = getHrStatus(vitals?.fused_hr, isEnglish);
  const respStatus = getRespStatus(vitals?.radar_resp, isEnglish);
  const movStatus = getMovementStatus(vitals?.movement, isEnglish);
  const bviStatus = getBviStatus(vitals?.bvi, isEnglish);

  // Prepare chart data
  const chartData = vitalsHistory.map((v, i) => ({
    time: new Date(v.timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    }),
    hr: v.fused_hr,
    resp: v.radar_resp,
    index: i,
  }));

  const waiting = !vitals;

  // For initial state, show at least one point
  const displayChartData = chartData.length > 0 ? chartData : (
    isDemoMode && vitals ? [{
      time: new Date(vitals.timestamp).toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
      }),
      hr: vitals.fused_hr,
      resp: vitals.radar_resp,
      index: 0,
    }] : []
  );

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-4">
      {/* MQTT Config Panel */}
      {dataSource === 'mqtt' && (
        <div
          className="rounded-xl border shadow-sm overflow-hidden"
          style={{ borderColor: mqttConnected ? 'rgba(16,185,129,0.3)' : mqttStatus === 'error' ? 'rgba(239,68,68,0.3)' : 'var(--border)' }}
        >
          <button
            onClick={() => setShowMqttConfig(p => !p)}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-white hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              {mqttConnected
                ? <Wifi size={13} className="text-emerald-500" />
                : <WifiOff size={13} className="text-muted-foreground" />}
              <span className="text-xs font-semibold text-foreground">
                {isEnglish ? 'MQTT Connection' : 'MQTT 实时连接'}
              </span>
              <span
                className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                style={{
                  backgroundColor: mqttConnected ? 'rgba(16,185,129,0.1)' : mqttStatus === 'connecting' ? 'rgba(245,158,11,0.1)' : mqttStatus === 'error' ? 'rgba(239,68,68,0.1)' : 'var(--muted)',
                  color: mqttConnected ? '#10b981' : mqttStatus === 'connecting' ? '#f59e0b' : mqttStatus === 'error' ? '#ef4444' : 'var(--muted-foreground)',
                }}
              >
                {mqttStatus === 'connected' ? (isEnglish ? '● Connected' : '● 已连接')
                  : mqttStatus === 'connecting' ? (isEnglish ? '◌ Connecting...' : '◌ 连接中...')
                  : mqttStatus === 'error' ? (isEnglish ? '✕ Error' : '✕ 错误')
                  : (isEnglish ? '○ Disconnected' : '○ 未连接')}
              </span>
              {mqttError && (
                <span className="text-[10px] text-red-500 truncate max-w-xs">{mqttError}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Settings2 size={12} className="text-muted-foreground" />
              {showMqttConfig ? <ChevronUp size={12} className="text-muted-foreground" /> : <ChevronDown size={12} className="text-muted-foreground" />}
            </div>
          </button>

          {showMqttConfig && (
            <div className="px-4 py-3 bg-muted/20 border-t border-border space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-medium text-muted-foreground block mb-1">
                    {isEnglish ? 'Broker URL (WebSocket)' : 'Broker 地址 (WebSocket)'}
                  </label>
                  <input
                    type="text"
                    value={localBroker}
                    onChange={e => setLocalBroker(e.target.value)}
                    placeholder="ws://192.168.1.100:9001"
                    className="w-full text-[11px] px-2.5 py-1.5 rounded border border-border bg-white font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <p className="text-[9px] text-muted-foreground mt-0.5">
                    {isEnglish ? 'Mosquitto WebSocket port (default 9001)' : 'Mosquitto WebSocket 端口（默认 9001）'}
                  </p>
                </div>
                <div>
                  <label className="text-[10px] font-medium text-muted-foreground block mb-1">
                    {isEnglish ? 'Topic' : 'MQTT 主题'}
                  </label>
                  <input
                    type="text"
                    value={localTopic}
                    onChange={e => setLocalTopic(e.target.value)}
                    placeholder="companion/status"
                    className="w-full text-[11px] px-2.5 py-1.5 rounded border border-border bg-white font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-muted-foreground block mb-1">
                    {isEnglish ? 'Username (optional)' : '用户名（可选）'}
                  </label>
                  <input
                    type="text"
                    value={localUser}
                    onChange={e => setLocalUser(e.target.value)}
                    className="w-full text-[11px] px-2.5 py-1.5 rounded border border-border bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-muted-foreground block mb-1">
                    {isEnglish ? 'Password (optional)' : '密码（可选）'}
                  </label>
                  <input
                    type="password"
                    value={localPass}
                    onChange={e => setLocalPass(e.target.value)}
                    className="w-full text-[11px] px-2.5 py-1.5 rounded border border-border bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setMqttSettings({ brokerUrl: localBroker, topic: localTopic, username: localUser || undefined, password: localPass || undefined });
                    connectMqtt();
                  }}
                  className="px-4 py-1.5 bg-primary text-primary-foreground text-[11px] font-semibold rounded-lg hover:opacity-90 transition-opacity"
                >
                  {mqttConnected ? (isEnglish ? 'Reconnect' : '重新连接') : (isEnglish ? 'Connect' : '连接')}
                </button>
                {mqttConnected && (
                  <button
                    onClick={disconnectMqtt}
                    className="px-4 py-1.5 bg-red-50 text-red-500 border border-red-200 text-[11px] font-semibold rounded-lg hover:bg-red-100 transition-colors"
                  >
                    {isEnglish ? 'Disconnect' : '断开连接'}
                  </button>
                )}
                <span className="text-[10px] text-muted-foreground">
                  {isEnglish
                    ? 'Jetson Nano must have Mosquitto with WebSocket enabled (port 9001)'
                    : 'Jetson Nano 需启用 Mosquitto WebSocket（端口 9001）'}
                </span>
              </div>
            </div>
          )}
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
        <div className="flex items-center gap-1.5 text-xs text-emerald-500 font-semibold">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 live-dot" />
          {isEnglish ? '· Live' : '· 实时'}
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
              {waiting ? '--' : (vitals?.fused_hr ?? '--')}
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
              {waiting ? '--' : (vitals?.radar_resp ?? '--')}
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
              {waiting ? '--' : (vitals?.movement ?? '--')}
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
              {waiting ? '--' : (vitals?.bvi ?? '--')}
            </span>
            <span className="text-sm text-muted-foreground">BVI</span>
          </div>
          <div className="text-xs text-muted-foreground">{isEnglish ? 'Vitality Index' : '活力指数 Vitality Index'}</div>
          <div className="text-[10px] text-muted-foreground/60 mt-0.5">Active</div>
        </div>
      </div>

      {/* Waveform + Fused HR */}
      <div className="grid grid-cols-3 gap-3">
        {/* HR/Resp Waveform - 2/3 width */}
        <div className="col-span-2 bg-white rounded-xl p-4 border border-border shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-semibold text-foreground">
                  {isEnglish ? 'HR / Resp Waveform' : '心率 / 呼吸率实时波形'}
                </span>
                <span className="text-xs text-muted-foreground">HR / Resp Waveform</span>
              </div>
              <p className="text-[10px] text-muted-foreground">{isEnglish ? 'Last 60 seconds' : '最近 60 秒数据'}</p>
            </div>
            <div className="flex items-center gap-3 text-[11px]">
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-rose-400" />
                <span className="text-muted-foreground font-mono">{vitals?.fused_hr ?? '--'} bpm</span>
              </span>
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-teal-400" />
                <span className="text-muted-foreground font-mono">{vitals?.radar_resp ?? '--'} /min</span>
              </span>
            </div>
          </div>

          <div className="h-40">
            {displayChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={displayChartData} margin={{ top: 5, right: 5, bottom: 5, left: -25 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 9, fill: '#9ca3af', fontFamily: 'IBM Plex Mono' }}
                    interval="preserveStartEnd"
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 9, fill: '#9ca3af' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb', fontFamily: 'IBM Plex Sans' }}
                    formatter={(val: number, name: string) => [val, name === 'hr' ? 'Heart Rate (bpm)' : 'Resp Rate (/min)']}
                  />
                  <Line
                    type="monotone"
                    dataKey="hr"
                    stroke="#fb7185"
                    strokeWidth={1.5}
                    dot={false}
                    activeDot={{ r: 3, fill: '#fb7185' }}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="resp"
                    stroke="#2dd4bf"
                    strokeWidth={1.5}
                    dot={false}
                    activeDot={{ r: 3, fill: '#2dd4bf' }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground/40">
                <Activity size={22} className="mb-2" />
                <p className="text-xs">{isEnglish ? 'Waiting for data...' : '等待数据...'}</p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4 mt-1 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <div className="w-5 h-px" style={{ background: '#fb7185' }} />
              {isEnglish ? 'Heart Rate' : '心率 HR'}
            </span>
            <span className="flex items-center gap-1.5">
              <div className="w-5 h-px" style={{ background: '#2dd4bf' }} />
              {isEnglish ? 'Resp. Rate' : '呼吸率 Resp'}
            </span>
          </div>
        </div>

        {/* Fused HR Algorithm - 1/3 width */}
        <div className="bg-white rounded-xl p-4 border border-border shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <GitMerge size={13} className="text-primary" />
            <span className="text-sm font-semibold text-foreground">
              {isEnglish ? 'Fused HR Algorithm' : '融合心率算法'}
            </span>
          </div>

          <div className="text-center py-3">
            <div
              className="text-5xl font-bold text-primary"
              style={{ fontFamily: "'IBM Plex Mono', monospace" }}
            >
              {waiting ? '--' : (vitals?.fused_hr ?? '--')}
            </div>
            <div className="flex items-center justify-center gap-1 mt-1 text-xs text-muted-foreground">
              <span>bpm</span>
              <span>·</span>
              <span>{isEnglish ? 'Fused Result' : '融合结果'}</span>
            </div>
          </div>

          <div className="space-y-2 mt-1">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-rose-400" />
                <span className="text-muted-foreground">Radar (R60ABD1)</span>
              </span>
              <span className="font-mono font-medium text-foreground text-[11px]">
                {vitals?.radar_hr ? `${vitals.radar_hr} bpm` : '--'}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-pink-400" />
                <span className="text-muted-foreground">PPG Sensor (STM32)</span>
              </span>
              <span className="font-mono font-medium text-foreground text-[11px]">
                {displayPpgHr(vitals?.ppg_hr)}{vitals?.ppg_hr && vitals.ppg_hr > 0 ? ' bpm' : ''}
              </span>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-border">
            <p className="text-[10px] text-muted-foreground">
              Method: {getFusionRuleLabel(vitals?.fusion_rule, isEnglish)}
            </p>
          </div>
        </div>
      </div>

      {/* Target ID + PPG Sensor */}
      <div className="grid grid-cols-2 gap-3">
        {/* Target ID */}
        <div className="bg-white rounded-xl p-4 border border-border shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Zap size={13} className="text-primary" />
              <span className="text-sm font-semibold text-foreground">
                {isEnglish ? 'Target ID' : '目标识别 Target ID'}
              </span>
              <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">(CA1)</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{isEnglish ? 'Result' : '判定结果'}</span>
                <span className={`font-semibold ${vitals?.target_id === 'human' ? 'text-emerald-500' : vitals?.target_id === 'pet' ? 'text-amber-500' : 'text-muted-foreground'}`}>
                  {vitals?.target_id === 'human' ? '● Human' : vitals?.target_id === 'pet' ? '● Pet' : '○ None'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{isEnglish ? 'Timestamp' : '时间戳'}</span>
                <span className="font-mono text-primary text-[11px]">
                  {vitals ? new Date(vitals.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : '--:--:--'}
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-[10px] text-muted-foreground/60">STM32 Hardware Time Sync</div>
              <div className="flex items-center gap-1.5 text-[10px] text-emerald-500">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Voice Alert Active
              </div>
            </div>
          </div>
        </div>

        {/* PPG Sensor */}
        <div className="bg-white rounded-xl p-4 border border-border shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Heart size={13} className="text-pink-400" />
              <span className="text-sm font-semibold text-foreground">
                {isEnglish ? 'PPG Sensor' : 'PPG 传感器'}
              </span>
              <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">(STM32)</span>
            </div>
            <span className={`text-xs font-semibold flex items-center gap-1 ${vitals?.ppg_status === 'ACTIVE' ? 'text-emerald-500' : 'text-muted-foreground'}`}>
              {vitals?.ppg_status === 'ACTIVE' && <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 live-dot" />}
              {vitals?.ppg_status === 'ACTIVE' ? 'Connected' : (isEnglish ? 'No Signal' : 'No Signal')}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <div className="text-[10px] text-muted-foreground mb-0.5">PPG Heart Rate</div>
              <div className="text-lg font-bold font-mono text-foreground">
                {displayPpgHr(vitals?.ppg_hr)}
                {vitals?.ppg_hr && vitals.ppg_hr > 0 && <span className="text-xs font-normal text-muted-foreground ml-0.5">bpm</span>}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground mb-0.5">SpO₂</div>
              <div className="text-lg font-bold font-mono text-emerald-500">
                {vitals?.ppg_spo2 ? `${vitals.ppg_spo2}%` : '--'}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground mb-0.5">Signal Quality</div>
              <div className="flex flex-col gap-1">
                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-rose-400 rounded-full transition-all duration-500"
                    style={{ width: `${vitals?.ppg_quality ?? 0}%` }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground">{vitals?.ppg_quality ?? '--'}%</span>
              </div>
            </div>
          </div>

          <div className="text-[10px] text-muted-foreground/60 mt-2">
            Normal: SpO₂ ≥ 95%, HR 60-100 bpm
          </div>
        </div>
      </div>
    </div>
  );
}
