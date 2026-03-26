// Guardian Dashboard - Behavioral Vitality Index (BVI) Page
// CA1 Improvement: EVI redesigned as BVI

import { TrendingUp, Activity, Clock, Zap, Info } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts';
import { useDashboard } from '../contexts/DashboardContext';

const BVI_LEVELS = [
  { range: '70–100', label: 'Active', label_zh: '活跃', color: '#10b981', desc: 'Frequent activity, good condition', desc_zh: '频繁活动，状态良好' },
  { range: '50–69', label: 'Good', label_zh: '良好', color: '#14b8a6', desc: 'Normal activity level', desc_zh: '正常活动水平' },
  { range: '30–49', label: 'Moderate', label_zh: '一般', color: '#f59e0b', desc: 'Low activity, needs attention', desc_zh: '活动较少，需关注' },
  { range: '0–29', label: 'Low', label_zh: '偏低', color: '#ef4444', desc: 'Extended stillness, urgent attention', desc_zh: '长时间静止，需紧急关注' },
];

function getBviLevel(bvi: number) {
  if (bvi >= 70) return BVI_LEVELS[0];
  if (bvi >= 50) return BVI_LEVELS[1];
  if (bvi >= 30) return BVI_LEVELS[2];
  return BVI_LEVELS[3];
}

export default function VitalityIndex() {
  const { bviHistory, vitals, isEnglish } = useDashboard();

  const currentBVI = vitals?.bvi ?? 79;
  const currentLevel = getBviLevel(currentBVI);

  // Summary stats
  const avgBVI = Math.round(bviHistory.reduce((s, p) => s + p.bvi, 0) / bviHistory.length);
  const activeTime = bviHistory.filter(p => p.bvi >= 40).length * 5; // 5 min per point
  const restingTime = bviHistory.filter(p => p.bvi < 40).length * 5;
  const peakBVI = Math.max(...bviHistory.map(p => p.bvi));

  // Downsample for chart (every 3rd point for performance)
  const chartData = bviHistory.filter((_, i) => i % 2 === 0);

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      {/* Header */}
      <div>
        <div className="flex items-baseline gap-2">
          <h2 className="text-xl font-semibold text-foreground">
            {isEnglish ? 'Behavioral Vitality Index (BVI)' : '行为活力指数 (BVI)'}
          </h2>
          <span className="text-sm text-muted-foreground font-normal">Behavioral Vitality Index</span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {isEnglish
            ? 'CA1 Improvement: Objective behavior data replaces subjective emotion assessment'
            : 'CA1 Improvement: Objective behavior data replaces subjective emotion assessment'}
        </p>
      </div>

      {/* CA1 Improvement Banner */}
      <div className="bg-teal-50 border border-teal-200 rounded-xl px-4 py-3 flex items-start gap-2">
        <Info size={14} className="text-teal-600 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-teal-700">
          <span className="font-semibold">CA1 Improvement: </span>
          {isEnglish
            ? 'EVI redesigned as BVI — computed from radar-detected daily active/resting ratio, no complex medical hardware required.'
            : 'EVI 重新设计为 BVI — 通过雷达检测的日常活跃/静息比例计算，无需复杂医疗硬件。'}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-border shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={14} className="text-amber-500" />
            <span className="text-xs text-muted-foreground">{isEnglish ? 'Avg BVI' : '平均 BVI'}</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-amber-500 font-mono">{avgBVI}</span>
            <span className="text-xs text-muted-foreground">/ 100</span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">{isEnglish ? 'Moderate' : 'Moderate'}</div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-border shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Activity size={14} className="text-emerald-500" />
            <span className="text-xs text-muted-foreground">{isEnglish ? 'Active Time' : '活跃时间'}</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-emerald-500 font-mono">{activeTime}</span>
            <span className="text-xs text-muted-foreground">min</span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">BVI ≥ 40 periods</div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-border shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={14} className="text-blue-400" />
            <span className="text-xs text-muted-foreground">{isEnglish ? 'Resting Time' : '静息时间'}</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-blue-400 font-mono">{restingTime}</span>
            <span className="text-xs text-muted-foreground">min</span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">BVI &lt; 40 periods</div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-border shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Zap size={14} className="text-primary" />
            <span className="text-xs text-muted-foreground">{isEnglish ? 'Peak BVI' : '峰值 BVI'}</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-primary font-mono">{peakBVI}</span>
            <span className="text-xs text-muted-foreground">/ 100</span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">{isEnglish ? 'Active' : 'Active'}</div>
        </div>
      </div>

      {/* 24h BVI Trend Chart */}
      <div className="bg-white rounded-xl p-5 border border-border shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-semibold text-foreground">
                {isEnglish ? '24h BVI Trend' : '24小时 BVI 趋势'}
              </span>
              <span className="text-xs text-muted-foreground">24h BVI Trend</span>
            </div>
            <p className="text-[11px] text-muted-foreground">{isEnglish ? 'Active vs Resting Distribution' : '活跃 vs 静息分布'}</p>
          </div>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
            {isEnglish ? 'Historical Demo' : '历史演示'}
          </span>
        </div>

        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
              <defs>
                <linearGradient id="bviGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#14b8a6" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 9, fill: '#9ca3af' }}
                interval={Math.floor(chartData.length / 8)}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 9, fill: '#9ca3af' }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb' }}
                formatter={(val: number) => [val, 'BVI']}
              />
              <ReferenceLine y={70} stroke="#10b981" strokeDasharray="4 4" strokeWidth={1} label={{ value: '70', fontSize: 9, fill: '#10b981' }} />
              <ReferenceLine y={40} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={1} label={{ value: '40', fontSize: 9, fill: '#f59e0b' }} />
              <Area
                type="monotone"
                dataKey="bvi"
                stroke="#14b8a6"
                strokeWidth={2}
                fill="url(#bviGrad)"
                dot={false}
                activeDot={{ r: 3, fill: '#14b8a6' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="flex items-center gap-4 mt-2 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <div className="w-4 h-0.5 bg-teal-400" />
            BVI
          </span>
          <span className="flex items-center gap-1.5">
            <div className="w-4 h-0.5 bg-amber-400 border-t border-dashed border-amber-400" />
            {isEnglish ? 'Active threshold 40' : '活跃阈值 40'}
          </span>
          <span className="flex items-center gap-1.5">
            <div className="w-4 h-0.5 bg-emerald-400 border-t border-dashed border-emerald-400" />
            {isEnglish ? 'Good threshold 70' : '良好阈值 70'}
          </span>
        </div>
      </div>

      {/* Current BVI Status + BVI Level Guide */}
      <div className="grid grid-cols-2 gap-4">
        {/* Current Status */}
        <div className="bg-white rounded-xl p-5 border border-border shadow-sm">
          <h3 className="text-sm font-semibold text-foreground mb-4">
            {isEnglish ? 'Current BVI Status' : '当前 BVI 状态'}
          </h3>
          <div className="flex items-center gap-4 mb-4">
            <span className="text-5xl font-bold font-mono" style={{ color: currentLevel.color }}>
              {currentBVI}
            </span>
            <div>
              <div className="text-lg font-semibold" style={{ color: currentLevel.color }}>
                {isEnglish ? currentLevel.label : currentLevel.label_zh}
              </div>
              <div className="text-xs text-muted-foreground">— {isEnglish ? 'Stable' : '稳定'}</div>
            </div>
          </div>
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${currentBVI}%`, backgroundColor: currentLevel.color }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
            <span>0</span>
            <span>25</span>
            <span>50</span>
            <span>75</span>
            <span>100</span>
          </div>

          {/* BVI Calculation Explanation */}
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-[11px] text-muted-foreground font-medium mb-2">
              {isEnglish ? 'BVI Calculation (CA1)' : 'BVI 计算逻辑 (CA1)'}
            </p>
            <div className="space-y-1 text-[10px] text-muted-foreground">
              <div className="flex justify-between">
                <span>Activity Score</span>
                <span className="font-mono">movement / 10.0</span>
              </div>
              <div className="flex justify-between">
                <span>Active Threshold</span>
                <span className="font-mono">movement &gt; 1.5</span>
              </div>
              <div className="flex justify-between">
                <span>High Activity</span>
                <span className="font-mono">movement &gt; 5.0</span>
              </div>
              <div className="flex justify-between">
                <span>Alert: BVI Low</span>
                <span className="font-mono text-amber-500">&lt; 30 (09:00–21:00)</span>
              </div>
              <div className="flex justify-between">
                <span>Alert: BVI Critical</span>
                <span className="font-mono text-red-500">&lt; 15 (urgent)</span>
              </div>
            </div>
          </div>
        </div>

        {/* BVI Level Guide */}
        <div className="bg-white rounded-xl p-5 border border-border shadow-sm">
          <h3 className="text-sm font-semibold text-foreground mb-4">
            {isEnglish ? 'BVI Level Guide' : 'BVI 等级说明'}
          </h3>
          <div className="space-y-3">
            {BVI_LEVELS.map(level => (
              <div key={level.label} className="flex items-start gap-3">
                <div className="flex items-center gap-2 w-28 flex-shrink-0">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: level.color }} />
                  <span className="text-xs font-medium text-muted-foreground">{level.range}</span>
                </div>
                <div>
                  <div className="text-xs font-semibold" style={{ color: level.color }}>
                    {isEnglish ? level.label : level.label_zh}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {isEnglish ? level.desc : level.desc_zh}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Nocturnal Anomaly Detection */}
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-[11px] text-muted-foreground font-medium mb-2">
              {isEnglish ? 'Nocturnal Anomaly Detection (CA1)' : '夜间异常检测 (CA1)'}
            </p>
            <div className="space-y-1 text-[10px] text-muted-foreground">
              <div>· {isEnglish ? 'Respiratory rate deviation >20% from baseline' : '呼吸频率偏离基线 >20%'}</div>
              <div>· {isEnglish ? 'Heart rate baseline deviation monitoring' : '心率基线偏差监测'}</div>
              <div>· {isEnglish ? 'Active window: 22:00–07:00' : '检测窗口：22:00–07:00'}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
