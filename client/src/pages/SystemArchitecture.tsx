// Guardian Dashboard - System Architecture Page
// Visual overview of the full edge AI pipeline:
// Sensors → Jetson Edge → Cloud AI → Dashboard

import { useDashboard } from '../contexts/DashboardContext';
import { Cpu, Wifi, Cloud, Monitor, ArrowRight, Radio, Heart, Brain, Volume2, Bell, BarChart2, MessageSquare, Zap, Shield, Database } from 'lucide-react';

interface ArchNode {
  id: string;
  icon: React.ReactNode;
  title: string;
  title_zh: string;
  subtitle: string;
  subtitle_zh: string;
  specs: string[];
  color: string;
  bgColor: string;
  borderColor: string;
}

interface ArchLayer {
  id: string;
  label: string;
  label_zh: string;
  color: string;
  nodes: ArchNode[];
}

const ARCH_LAYERS: ArchLayer[] = [
  {
    id: 'sensors',
    label: 'Sensor Layer',
    label_zh: '传感器层',
    color: '#3b82f6',
    nodes: [
      {
        id: 'radar',
        icon: <Radio size={20} />,
        title: 'R60ABD1 Radar',
        title_zh: 'R60ABD1 毫米波雷达',
        subtitle: '60GHz mmWave',
        subtitle_zh: '60GHz 毫米波',
        specs: ['Heart Rate (HR)', 'Respiration Rate (RR)', 'Body Movement', 'Target Detection (CA1)'],
        color: '#3b82f6',
        bgColor: '#eff6ff',
        borderColor: '#bfdbfe',
      },
      {
        id: 'ppg',
        icon: <Heart size={20} />,
        title: 'DFRobot PPG',
        title_zh: 'DFRobot PPG 传感器',
        subtitle: 'STM32F103C6T6',
        subtitle_zh: 'STM32 微控制器',
        specs: ['PPG Heart Rate', 'SpO₂ Blood Oxygen', 'Signal Quality', 'UART @ 115200'],
        color: '#ec4899',
        bgColor: '#fdf2f8',
        borderColor: '#fbcfe8',
      },
    ],
  },
  {
    id: 'edge',
    label: 'Edge Computing Layer',
    label_zh: '边缘计算层',
    color: '#f59e0b',
    nodes: [
      {
        id: 'jetson',
        icon: <Cpu size={20} />,
        title: 'NVIDIA Jetson Nano B01',
        title_zh: 'NVIDIA Jetson Nano B01',
        subtitle: '4GB RAM · 128-core Maxwell GPU',
        subtitle_zh: '4GB 内存 · 128核 Maxwell GPU',
        specs: [
          'HR Fusion (RULE1–4)',
          'BVI Calculation Engine',
          'Alert Rule Engine (6 rules)',
          'Human/Pet Discrimination',
          'Whisper STT (local)',
          'Edge-TTS / pyttsx3',
        ],
        color: '#f59e0b',
        bgColor: '#fffbeb',
        borderColor: '#fde68a',
      },
    ],
  },
  {
    id: 'cloud',
    label: 'Cloud AI Layer',
    label_zh: '云端 AI 层',
    color: '#8b5cf6',
    nodes: [
      {
        id: 'qwen',
        icon: <Brain size={20} />,
        title: 'Qwen-Turbo LLM',
        title_zh: 'Qwen-Turbo 大语言模型',
        subtitle: 'Alibaba Cloud · DashScope API',
        subtitle_zh: '阿里云 · DashScope API',
        specs: [
          'Proactive companion dialogue',
          'Context-aware responses',
          'Alert-triggered responses',
          'Daily report generation',
          'Bilingual (ZH/EN)',
        ],
        color: '#8b5cf6',
        bgColor: '#f5f3ff',
        borderColor: '#ddd6fe',
      },
    ],
  },
  {
    id: 'dashboard',
    label: 'Dashboard Layer',
    label_zh: '仪表板层',
    color: '#10b981',
    nodes: [
      {
        id: 'ui',
        icon: <Monitor size={20} />,
        title: 'Guardian Dashboard',
        title_zh: 'Guardian 仪表板',
        subtitle: 'React + TypeScript · tRPC',
        subtitle_zh: 'React + TypeScript · tRPC',
        specs: [
          'Live Vitals Monitor',
          'BVI Trend Analysis',
          'Alert History + Notifications',
          'AI Companion Log',
          'Daily Health Report',
          'Bilingual UI (ZH/EN)',
        ],
        color: '#10b981',
        bgColor: '#f0fdf4',
        borderColor: '#bbf7d0',
      },
    ],
  },
];

const DATA_FLOWS = [
  { from: 'sensors', to: 'edge', label: 'UART / GPIO', label_zh: 'UART / GPIO 串口', color: '#3b82f6' },
  { from: 'edge', to: 'cloud', label: 'HTTPS REST', label_zh: 'HTTPS REST API', color: '#f59e0b' },
  { from: 'edge', to: 'dashboard', label: 'HTTP POST + WebSocket', label_zh: 'HTTP POST + WebSocket', color: '#10b981' },
  { from: 'cloud', to: 'dashboard', label: 'tRPC / JSON', label_zh: 'tRPC / JSON', color: '#8b5cf6' },
];

const KEY_INNOVATIONS = [
  {
    icon: <Zap size={14} className="text-amber-500" />,
    title: 'HR Fusion Algorithm',
    title_zh: '心率融合算法',
    desc: '4-rule weighted fusion of radar + PPG, robust to single-sensor failure',
    desc_zh: '4规则加权融合雷达+PPG，单传感器故障时自动降级',
    color: '#f59e0b',
  },
  {
    icon: <BarChart2 size={14} className="text-teal-500" />,
    title: 'BVI Index (CA1 Improvement)',
    title_zh: 'BVI 活力指数（CA1改进）',
    desc: 'Objective behavior-based vitality score replacing subjective EVI',
    desc_zh: '基于行为的客观活力评分，替代主观情绪评估',
    color: '#14b8a6',
  },
  {
    icon: <Shield size={14} className="text-blue-500" />,
    title: 'Human/Pet Discrimination',
    title_zh: '人宠区分算法',
    desc: 'RCS energy + target height dual-filter reduces false alarms',
    desc_zh: 'RCS能量+目标高度双重过滤，降低宠物误报率',
    color: '#3b82f6',
  },
  {
    icon: <MessageSquare size={14} className="text-purple-500" />,
    title: 'Proactive Agent Loop',
    title_zh: '主动陪伴 Agent 闭环',
    desc: 'BVI-driven patrol → Qwen AI → TTS → full autonomous companion cycle',
    desc_zh: 'BVI驱动巡检→Qwen AI→TTS播报→完整自主陪伴闭环',
    color: '#8b5cf6',
  },
  {
    icon: <Bell size={14} className="text-red-500" />,
    title: 'Multi-level Alert Engine',
    title_zh: '多级报警引擎',
    desc: '6 alert rules: fall, HR high/low, SpO₂ low, BVI low, nocturnal anomaly',
    desc_zh: '6条报警规则：跌倒、心率高/低、血氧低、BVI低、夜间异常',
    color: '#ef4444',
  },
  {
    icon: <Database size={14} className="text-emerald-500" />,
    title: 'Edge-First Architecture',
    title_zh: '边缘优先架构',
    desc: 'All sensor processing and alerts run locally on Jetson, cloud only for AI',
    desc_zh: '传感器处理和报警全部在Jetson本地运行，云端仅用于AI生成',
    color: '#10b981',
  },
];

export default function SystemArchitecture() {
  const { isEnglish } = useDashboard();

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-baseline gap-2">
          <h2 className="text-xl font-semibold text-foreground">
            {isEnglish ? 'System Architecture' : '系统架构'}
          </h2>
          <span className="text-sm text-muted-foreground font-normal">Edge AI Pipeline</span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {isEnglish
            ? 'Full pipeline from sensor hardware to cloud AI to dashboard visualization'
            : '从传感器硬件到云端AI再到仪表板可视化的完整数据流'}
        </p>
      </div>

      {/* Architecture Diagram */}
      <div className="bg-white rounded-xl p-6 border border-border shadow-sm">
        <h3 className="text-sm font-semibold text-foreground mb-5 flex items-center gap-2">
          <Cpu size={14} className="text-primary" />
          {isEnglish ? 'Data Flow Architecture' : '数据流架构图'}
        </h3>

        <div className="space-y-3">
          {ARCH_LAYERS.map((layer, layerIdx) => (
            <div key={layer.id}>
              {/* Layer */}
              <div className="flex items-start gap-3">
                {/* Layer Label */}
                <div
                  className="flex-shrink-0 w-28 text-right pt-3"
                >
                  <span
                    className="text-[10px] font-semibold px-2 py-1 rounded"
                    style={{ color: layer.color, backgroundColor: `${layer.color}15` }}
                  >
                    {isEnglish ? layer.label : layer.label_zh}
                  </span>
                </div>

                {/* Nodes */}
                <div className="flex-1 flex gap-3 flex-wrap">
                  {layer.nodes.map(node => (
                    <div
                      key={node.id}
                      className="flex-1 min-w-[200px] rounded-xl p-4 border"
                      style={{ backgroundColor: node.bgColor, borderColor: node.borderColor }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: `${node.color}20`, color: node.color }}
                        >
                          {node.icon}
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-foreground">
                            {isEnglish ? node.title : node.title_zh}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {isEnglish ? node.subtitle : node.subtitle_zh}
                          </div>
                        </div>
                      </div>
                      <div className="space-y-0.5">
                        {node.specs.map((spec, i) => (
                          <div key={i} className="flex items-center gap-1.5">
                            <div
                              className="w-1 h-1 rounded-full flex-shrink-0"
                              style={{ backgroundColor: node.color }}
                            />
                            <span className="text-[10px] text-muted-foreground">{spec}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Arrow between layers */}
              {layerIdx < ARCH_LAYERS.length - 1 && (
                <div className="flex items-center gap-3 my-1">
                  <div className="w-28 flex-shrink-0" />
                  <div className="flex-1 flex items-center gap-2 pl-4">
                    <ArrowRight
                      size={14}
                      style={{ color: DATA_FLOWS[layerIdx]?.color ?? '#9ca3af' }}
                    />
                    <span
                      className="text-[10px] font-mono px-2 py-0.5 rounded"
                      style={{
                        color: DATA_FLOWS[layerIdx]?.color ?? '#9ca3af',
                        backgroundColor: `${DATA_FLOWS[layerIdx]?.color ?? '#9ca3af'}15`,
                      }}
                    >
                      {isEnglish
                        ? DATA_FLOWS[layerIdx]?.label
                        : DATA_FLOWS[layerIdx]?.label_zh}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Key Innovations */}
      <div className="bg-white rounded-xl p-5 border border-border shadow-sm">
        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <Zap size={14} className="text-amber-500" />
          {isEnglish ? 'Key Technical Innovations' : '核心技术创新点'}
        </h3>
        <div className="grid grid-cols-3 gap-3">
          {KEY_INNOVATIONS.map((item, i) => (
            <div
              key={i}
              className="rounded-xl p-4 border"
              style={{ backgroundColor: `${item.color}08`, borderColor: `${item.color}30` }}
            >
              <div className="flex items-center gap-2 mb-2">
                {item.icon}
                <span className="text-xs font-semibold text-foreground">
                  {isEnglish ? item.title : item.title_zh}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                {isEnglish ? item.desc : item.desc_zh}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Agent Closed-Loop Flow */}
      <div className="bg-white rounded-xl p-5 border border-border shadow-sm">
        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <Brain size={14} className="text-purple-500" />
          {isEnglish ? 'Proactive Agent Closed-Loop' : '主动陪伴 Agent 闭环流程'}
        </h3>
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { icon: <Radio size={12} />, label: isEnglish ? 'Sensor Data\n@5s' : '传感器采集\n@5s', color: '#3b82f6' },
            { icon: <BarChart2 size={12} />, label: isEnglish ? 'BVI\nCalculation' : 'BVI\n计算', color: '#14b8a6' },
            { icon: <Bell size={12} />, label: isEnglish ? 'Alert Rule\nEngine' : '报警规则\n引擎', color: '#f59e0b' },
            { icon: <Brain size={12} />, label: isEnglish ? 'Patrol\nTrigger' : '巡检\n触发', color: '#8b5cf6' },
            { icon: <MessageSquare size={12} />, label: isEnglish ? 'Qwen AI\nGenerate' : 'Qwen AI\n生成', color: '#6366f1' },
            { icon: <Volume2 size={12} />, label: isEnglish ? 'TTS\nPlayback' : 'TTS\n播报', color: '#ec4899' },
            { icon: <Monitor size={12} />, label: isEnglish ? 'Dashboard\nUpdate' : '仪表板\n更新', color: '#10b981' },
          ].map((step, i, arr) => (
            <div key={i} className="flex items-center gap-2">
              <div
                className="flex flex-col items-center justify-center rounded-xl px-3 py-2.5 border text-center min-w-[72px]"
                style={{ backgroundColor: `${step.color}12`, borderColor: `${step.color}35`, color: step.color }}
              >
                <div className="mb-1">{step.icon}</div>
                <div className="text-[9px] font-medium leading-tight whitespace-pre-line">{step.label}</div>
              </div>
              {i < arr.length - 1 && (
                <ArrowRight size={12} className="text-muted-foreground flex-shrink-0" />
              )}
            </div>
          ))}
          {/* Loop back arrow */}
          <div className="flex items-center gap-1 text-[9px] text-muted-foreground ml-1">
            <span>↺</span>
            <span>{isEnglish ? 'Loop' : '循环'}</span>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground mt-3 leading-relaxed">
          {isEnglish
            ? 'Trigger conditions: BVI < 40 (sedentary alert) · No interaction for 60+ min (hourly patrol) · Alert event (immediate response) · Nocturnal check (03:00 AM)'
            : '触发条件：BVI < 40（久坐报警）· 超过60分钟无互动（每小时巡检）· 报警事件（立即响应）· 夜间巡检（凌晨3点）'}
        </p>
      </div>

      {/* Hardware Specs */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl p-5 border border-border shadow-sm">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Cpu size={14} className="text-amber-500" />
            {isEnglish ? 'Hardware Specifications' : '硬件规格'}
          </h3>
          <div className="space-y-2">
            {[
              { label: isEnglish ? 'Edge Platform' : '边缘平台', value: 'NVIDIA Jetson Nano B01' },
              { label: isEnglish ? 'Radar Sensor' : '雷达传感器', value: 'R60ABD1 · 60GHz mmWave' },
              { label: isEnglish ? 'PPG Sensor' : 'PPG 传感器', value: 'DFRobot · STM32F103C6T6' },
              { label: isEnglish ? 'Sampling Rate' : '采样频率', value: '5s interval (12/min)' },
              { label: isEnglish ? 'Detection Range' : '检测范围', value: '0.5m – 6m (radar)' },
              { label: isEnglish ? 'Power' : '功耗', value: '~10W (Jetson Nano)' },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{row.label}</span>
                <span className="font-mono text-foreground text-[11px]">{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-border shadow-sm">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Cloud size={14} className="text-purple-500" />
            {isEnglish ? 'Software Stack' : '软件技术栈'}
          </h3>
          <div className="space-y-2">
            {[
              { label: isEnglish ? 'Edge Runtime' : '边缘运行时', value: 'Python 3.8 · JetPack 4.6' },
              { label: isEnglish ? 'LLM' : '大语言模型', value: 'Qwen-Turbo (DashScope)' },
              { label: isEnglish ? 'STT' : '语音识别', value: 'OpenAI Whisper (local)' },
              { label: isEnglish ? 'TTS' : '语音合成', value: 'Edge-TTS / pyttsx3' },
              { label: isEnglish ? 'Frontend' : '前端', value: 'React 18 · TypeScript · Vite' },
              { label: isEnglish ? 'Backend' : '后端', value: 'Node.js · tRPC · PostgreSQL' },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{row.label}</span>
                <span className="font-mono text-foreground text-[11px]">{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
