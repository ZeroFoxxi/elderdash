// Guardian Dashboard - Demo Data Generator
// Produces realistic, smooth vital sign simulations

import type { VitalsData, AlertData, BVIDataPoint, ConversationMessage } from './types';

// Smooth sinusoidal HR variation: 75±8 bpm
export function generateDemoHR(tick: number, baseHr = 75): number {
  const slow = Math.sin(tick / 60) * 6;
  const fast = Math.sin(tick / 8) * 1.5;
  const noise = (Math.random() - 0.5) * 1.5;
  return Math.round(baseHr + slow + fast + noise);
}

export function generateDemoResp(tick: number): number {
  const base = 16;
  const variation = Math.sin(tick / 45) * 2;
  const noise = (Math.random() - 0.5) * 0.5;
  return Math.round(base + variation + noise);
}

export function generateDemoMovement(tick: number): number {
  // Simulate realistic movement: mostly still with occasional activity
  const base = 2.5 + Math.sin(tick / 120) * 1.5;
  const spike = Math.random() < 0.05 ? Math.random() * 8 : 0;
  return Math.round((base + spike) * 10) / 10;
}

export function generateDemoBVI(tick: number): number {
  // BVI follows activity pattern: higher during day, lower at night
  const base = 65;
  const trend = Math.sin(tick / 200) * 20;
  const noise = (Math.random() - 0.5) * 5;
  return Math.min(100, Math.max(0, Math.round(base + trend + noise)));
}

export function generateDemoVitals(tick: number): VitalsData {
  const radarHr = generateDemoHR(tick, 75);
  const ppgHr = generateDemoHR(tick + 3, 76); // Slightly offset for realism
  const fusedHr = Math.round(radarHr * 0.6 + ppgHr * 0.4);
  const movement = generateDemoMovement(tick);
  const bvi = generateDemoBVI(tick);
  
  return {
    heartRate: fusedHr,
    respRate: generateDemoResp(tick),
    movement,
    bvi,
    ppgHr,
    ppgSpo2: 98 + (Math.random() < 0.3 ? 1 : 0),
    ppgSignalQuality: 70 + Math.round(Math.random() * 25),
    ppgConnected: true,
    radarHr,
    fusedHr,
    fusedMethod: 'RULE4',
    targetId: 'Human',
    alert: null,
  };
}

export function generate24hBVIData(): BVIDataPoint[] {
  const points: BVIDataPoint[] = [];
  const now = new Date();
  
  // Generate 24h of data with realistic daily pattern
  for (let i = 288; i >= 0; i--) {
    const t = new Date(now.getTime() - i * 5 * 60 * 1000);
    const hour = t.getHours();
    
    // Daily pattern: low at night (0-6), rising morning (6-9), high day (9-21), falling evening (21-24)
    let baseBVI: number;
    if (hour >= 0 && hour < 6) {
      baseBVI = 15 + Math.random() * 15; // Sleep
    } else if (hour >= 6 && hour < 9) {
      baseBVI = 30 + (hour - 6) * 15 + Math.random() * 10; // Morning rise
    } else if (hour >= 9 && hour < 21) {
      baseBVI = 55 + Math.sin((hour - 9) / 12 * Math.PI) * 25 + Math.random() * 10; // Active day
    } else {
      baseBVI = 40 - (hour - 21) * 8 + Math.random() * 10; // Evening decline
    }
    
    const bvi = Math.min(100, Math.max(0, Math.round(baseBVI)));
    
    points.push({
      time: t.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
      bvi,
      active: bvi >= 40,
    });
  }
  
  return points;
}

export const DEMO_ALERTS: AlertData[] = [
  {
    type: 'FALL DETECTED',
    severity: 'Critical',
    message: 'Fall detected! Please confirm elderly status immediately.',
    message_zh: '检测到跌倒！（模拟测试）请立即确认老人状态。',
    timestamp: '03/25 21:35',
    acknowledged: false,
  },
  {
    type: 'spo2_low',
    severity: 'Critical',
    message: 'SpO₂ persistently low (89%), please rest. Seek medical attention if discomfort.',
    message_zh: '血氧饱和度持续偏低（89%），请注意休息，如有不适请立即就医。',
    timestamp: '03/25 21:11',
    acknowledged: false,
  },
  {
    type: 'fall',
    severity: 'Critical',
    message: 'Suspected fall: high body movement followed by 5s stillness',
    message_zh: '疑似跌倒：高体动后静止 5 秒',
    timestamp: '03/25 14:02',
    acknowledged: false,
  },
  {
    type: 'bvi_low',
    severity: 'Info',
    message: 'Behavioral Vitality Index low (18/100), encourage appropriate activity.',
    message_zh: '行为活力指数偏低（18/100），建议鼓励老人适当活动。',
    timestamp: '03/25 13:51',
    acknowledged: false,
  },
  {
    type: 'hr_high',
    severity: 'Warning',
    message: 'Heart rate persistently elevated 150 bpm, please rest and avoid strenuous activity.',
    message_zh: '心率持续偏高 150 bpm，请注意休息，避免剧烈活动。',
    timestamp: '03/25 13:51',
    acknowledged: false,
  },
  {
    type: 'hr_high',
    severity: 'Warning',
    message: 'Heart rate elevated 122 bpm, please rest.',
    message_zh: '心率偏高 122 bpm，请注意休息。',
    timestamp: '03/25 12:08',
    acknowledged: false,
  },
  {
    type: 'hr_high',
    severity: 'Warning',
    message: 'Heart rate elevated 121 bpm, please rest.',
    message_zh: '心率偏高 121 bpm，请注意休息。',
    timestamp: '03/25 11:42',
    acknowledged: false,
  },
  {
    type: 'nocturnal',
    severity: 'Warning',
    message: 'Nocturnal anomaly: respiratory rate deviation >20% from baseline (baseline 14/min, current 17/min)',
    message_zh: '夜间异常：呼吸频率偏离基线 >20%（基线 14/min，当前 17/min）',
    timestamp: '03/25 03:22',
    acknowledged: false,
    filtered_by_pet: false,
  },
  {
    type: 'hr_low',
    severity: 'Warning',
    message: 'Heart rate low 42 bpm, please check elderly status.',
    message_zh: '心率偏低 42 bpm，请检查老人状态。',
    timestamp: '03/24 22:15',
    acknowledged: true,
  },
  {
    type: 'bvi_low',
    severity: 'Info',
    message: 'BVI extremely low (12/100), urgent attention required.',
    message_zh: 'BVI 极低（12/100），需紧急关注。',
    timestamp: '03/24 15:30',
    acknowledged: true,
    filtered_by_pet: false,
  },
];

export const DEMO_CONVERSATIONS: ConversationMessage[] = [
  {
    id: '1',
    role: 'system',
    content: 'Hourly patrol initiated — BVI-driven proactive check',
    content_zh: '每小时巡检启动 — BVI 驱动主动问候',
    timestamp: '10:00:05',
    type: 'patrol',
  },
  {
    id: '2',
    role: 'ai',
    content: 'Good morning! I noticed you\'ve been active since 8 AM, that\'s wonderful! Your heart rate is stable at 76 bpm. How are you feeling today?',
    content_zh: '早上好！我注意到您从早上8点就开始活动了，真棒！您的心率稳定在76次/分。今天感觉怎么样？',
    timestamp: '10:00:08',
    type: 'patrol',
  },
  {
    id: '3',
    role: 'user',
    content: 'I\'m feeling good, just had breakfast.',
    content_zh: '感觉不错，刚吃完早饭。',
    timestamp: '10:00:45',
    type: 'conversation',
  },
  {
    id: '4',
    role: 'ai',
    content: 'That\'s great to hear! Breakfast is important. Your vitality index is at 72 today, which is in the "Active" range. Would you like to take a short walk after breakfast? Light exercise is very beneficial.',
    content_zh: '太好了！早饭很重要。您今天的活力指数是72，处于"活跃"范围。早饭后要不要散散步？轻度运动对身体很有益处。',
    timestamp: '10:01:02',
    type: 'conversation',
  },
  {
    id: '5',
    role: 'system',
    content: 'Alert triggered: hr_high (122 bpm) — AI companion responding',
    content_zh: '报警触发：心率偏高（122 bpm）— AI 陪伴响应中',
    timestamp: '12:08:33',
    type: 'alert_response',
  },
  {
    id: '6',
    role: 'ai',
    content: 'I noticed your heart rate has risen to 122 bpm. Are you doing some exercise? Please remember to rest if you feel tired. Take a deep breath and relax.',
    content_zh: '我注意到您的心率升高到了122次/分。您是在做运动吗？如果感到疲惫请记得休息。深呼吸，放松一下。',
    timestamp: '12:08:35',
    type: 'alert_response',
  },
  {
    id: '7',
    role: 'system',
    content: 'Nocturnal patrol — 03:00 check',
    content_zh: '夜间巡检 — 03:00 检查',
    timestamp: '03:00:12',
    type: 'nocturnal',
  },
  {
    id: '8',
    role: 'ai',
    content: 'It\'s 3 AM, I\'m checking on you. Your breathing rate is slightly elevated (17/min vs baseline 14/min). Are you sleeping well? If you\'re awake and need anything, I\'m here.',
    content_zh: '现在是凌晨3点，我来检查一下您的状况。您的呼吸频率略有升高（17次/分，基线14次/分）。睡眠还好吗？如果您醒着需要什么，我在这里。',
    timestamp: '03:00:15',
    type: 'nocturnal',
  },
];

export const DEMO_WORKFLOW_STEPS = [
  { step: 'Sensor Data Collection', detail: 'R60ABD1 radar + STM32 PPG @ 5s interval', status: 'completed' as const, timestamp: '10:45:10' },
  { step: 'HR Fusion (RULE4)', detail: 'Radar 60% + PPG 40% weighted fusion', status: 'completed' as const, timestamp: '10:45:11' },
  { step: 'BVI Calculation', detail: 'movement/10.0 normalized, active threshold >1.5', status: 'completed' as const, timestamp: '10:45:11' },
  { step: 'Human/Pet Discrimination', detail: 'RCS energy + target height dual-filter', status: 'completed' as const, timestamp: '10:45:12' },
  { step: 'Alert Rule Engine', detail: 'Checking 6 alert conditions...', status: 'completed' as const, timestamp: '10:45:12' },
  { step: 'Proactive Patrol Check', detail: 'BVI-driven hourly companion check', status: 'running' as const, timestamp: '10:45:13' },
  { step: 'MQTT Push to Dashboard', detail: 'companion/status topic @ 5s', status: 'pending' as const },
];
