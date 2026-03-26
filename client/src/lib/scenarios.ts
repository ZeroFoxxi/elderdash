// Guardian Dashboard - Demo Scenario Engine
// Simulates realistic multi-scenario vital sign data for demonstration
// Scenarios: Normal / HR High / Fall / Nocturnal / SpO2 Low

import type { VitalsData, AlertData } from './types';

export type ScenarioType = 'normal' | 'hr_high' | 'fall' | 'nocturnal' | 'spo2_low';

export interface ScenarioConfig {
  id: ScenarioType;
  label: string;
  label_zh: string;
  description: string;
  description_zh: string;
  icon: string;
  color: string;
  duration?: number;
}

export const SCENARIOS: ScenarioConfig[] = [
  {
    id: 'normal',
    label: 'Normal',
    label_zh: '正常状态',
    description: 'Stable vitals, active elderly',
    description_zh: '生理指标稳定，老人活跃',
    icon: '✓',
    color: '#10b981',
  },
  {
    id: 'hr_high',
    label: 'HR Elevated',
    label_zh: '心率偏高',
    description: 'Heart rate elevated 110-130 bpm',
    description_zh: '心率持续偏高 110-130 bpm',
    icon: '♥',
    color: '#f59e0b',
  },
  {
    id: 'fall',
    label: 'Fall Detected',
    label_zh: '跌倒检测',
    description: 'High movement → sudden stillness',
    description_zh: '高体动后突然静止，触发跌倒报警',
    icon: '⚠',
    color: '#ef4444',
  },
  {
    id: 'nocturnal',
    label: 'Nocturnal Anomaly',
    label_zh: '夜间异常',
    description: 'Respiratory deviation >20% from baseline',
    description_zh: '夜间呼吸频率偏离基线 >20%',
    icon: '🌙',
    color: '#8b5cf6',
  },
  {
    id: 'spo2_low',
    label: 'SpO₂ Low',
    label_zh: '血氧偏低',
    description: 'Blood oxygen persistently below 95%',
    description_zh: '血氧饱和度持续低于 95%',
    icon: '○',
    color: '#3b82f6',
  },
];

function smooth(current: number, target: number, maxChange: number): number {
  const diff = target - current;
  const change = Math.sign(diff) * Math.min(Math.abs(diff), maxChange);
  return current + change;
}

function noise(amplitude: number): number {
  return (Math.random() - 0.5) * 2 * amplitude;
}

export class ScenarioEngine {
  private tick = 0;
  private scenario: ScenarioType = 'normal';
  private fallPhase = 0;
  private fallTimer = 0;

  private currentHR = 75;
  private currentResp = 16;
  private currentMovement = 2.5;
  private currentBVI = 65;
  private currentSpo2 = 98;
  private currentPpgHr = 76;

  setScenario(s: ScenarioType) {
    this.scenario = s;
    if (s === 'fall') {
      this.fallPhase = 1;
      this.fallTimer = 0;
    }
  }

  getScenario(): ScenarioType {
    return this.scenario;
  }

  generate(): VitalsData {
    this.tick++;
    let alert: AlertData | null = null;

    let targetHR: number;
    let targetResp: number;
    let targetMovement: number;
    let targetBVI: number;
    let targetSpo2: number;
    let ppgConnected = true;
    let ppgSignalQuality = 80;
    let targetId = 'Human';
    let fusedMethod = 'RULE4';

    switch (this.scenario) {
      case 'normal':
        targetHR = 75 + Math.sin(this.tick / 60) * 6;
        targetResp = 16 + Math.sin(this.tick / 45) * 2;
        targetMovement = 2.5 + Math.sin(this.tick / 120) * 1.5;
        targetBVI = 65 + Math.sin(this.tick / 200) * 15;
        targetSpo2 = 98 + (Math.random() < 0.2 ? 1 : 0);
        ppgSignalQuality = 80 + Math.round(noise(8));
        break;

      case 'hr_high':
        targetHR = 118 + Math.sin(this.tick / 30) * 8;
        targetResp = 20 + Math.sin(this.tick / 40) * 2;
        targetMovement = 4 + noise(1);
        targetBVI = 55 + noise(5);
        targetSpo2 = 97 + (Math.random() < 0.3 ? 1 : 0);
        ppgSignalQuality = 75 + Math.round(noise(10));
        if (this.currentHR > 100) {
          alert = {
            type: 'hr_high',
            severity: 'Warning',
            message: `Heart rate elevated ${Math.round(this.currentHR)} bpm, please rest.`,
            message_zh: `心率偏高 ${Math.round(this.currentHR)} bpm，请注意休息。`,
            timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          };
        }
        break;

      case 'fall':
        this.fallTimer++;
        if (this.fallPhase === 1) {
          targetMovement = 160 + noise(20);
          targetHR = 95 + noise(5);
          targetResp = 22 + noise(2);
          targetBVI = 80;
          targetSpo2 = 97;
          ppgSignalQuality = 60 + Math.round(noise(10));
          if (this.fallTimer > 8) {
            this.fallPhase = 2;
            this.fallTimer = 0;
          }
        } else if (this.fallPhase === 2) {
          targetMovement = 0.2 + noise(0.1);
          targetHR = 88 + noise(3);
          targetResp = 18 + noise(1);
          targetBVI = 10;
          targetSpo2 = 96;
          ppgSignalQuality = 50 + Math.round(noise(10));
          if (this.fallTimer > 12) {
            this.fallPhase = 3;
            this.fallTimer = 0;
            alert = {
              type: 'FALL DETECTED',
              severity: 'Critical',
              message: 'Fall detected! High body movement followed by 8s stillness. Please confirm elderly status immediately.',
              message_zh: '检测到跌倒！高体动后静止 8 秒（连续5次确认）— 请立即确认老人状态！',
              timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            };
          }
        } else {
          targetMovement = 1 + noise(0.5);
          targetHR = 85 + noise(5);
          targetResp = 19 + noise(1);
          targetBVI = 20 + this.fallTimer * 0.5;
          targetSpo2 = 97;
          ppgSignalQuality = 70 + Math.round(noise(8));
          if (this.fallTimer > 30) {
            this.scenario = 'normal';
            this.fallPhase = 0;
          }
        }
        break;

      case 'nocturnal':
        targetHR = 62 + Math.sin(this.tick / 80) * 5;
        targetResp = 20 + Math.sin(this.tick / 50) * 3;
        targetMovement = 0.8 + noise(0.3);
        targetBVI = 18 + noise(5);
        targetSpo2 = 96 + (Math.random() < 0.3 ? 1 : 0);
        ppgSignalQuality = 55 + Math.round(noise(10));
        if (this.tick % 20 === 0) {
          alert = {
            type: 'nocturnal',
            severity: 'Warning',
            message: `Nocturnal anomaly: respiratory rate ${Math.round(this.currentResp)}/min vs baseline 14/min (>${Math.round((this.currentResp / 14 - 1) * 100)}% deviation)`,
            message_zh: `夜间异常：呼吸频率 ${Math.round(this.currentResp)}/min，基线 14/min（偏离 ${Math.round((this.currentResp / 14 - 1) * 100)}%）`,
            timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          };
        }
        break;

      case 'spo2_low':
        targetHR = 78 + Math.sin(this.tick / 60) * 5;
        targetResp = 22 + noise(2);
        targetMovement = 1.5 + noise(0.5);
        targetBVI = 35 + noise(5);
        targetSpo2 = 89 + Math.sin(this.tick / 30) * 3;
        ppgSignalQuality = 70 + Math.round(noise(10));
        if (this.currentSpo2 < 95) {
          alert = {
            type: 'spo2_low',
            severity: 'Critical',
            message: `SpO₂ persistently low (${Math.round(this.currentSpo2)}%), please rest. Seek medical attention if discomfort.`,
            message_zh: `血氧饱和度持续偏低（${Math.round(this.currentSpo2)}%），请注意休息，如有不适请立即就医。`,
            timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          };
        }
        break;

      default:
        targetHR = 75;
        targetResp = 16;
        targetMovement = 2.5;
        targetBVI = 65;
        targetSpo2 = 98;
    }

    // Smooth transitions
    this.currentHR = smooth(this.currentHR, targetHR + noise(1.5), 4);
    this.currentResp = smooth(this.currentResp, targetResp + noise(0.5), 2);
    this.currentMovement = smooth(
      this.currentMovement,
      targetMovement,
      this.scenario === 'fall' && this.fallPhase === 1 ? 50 : 1
    );
    this.currentBVI = smooth(this.currentBVI, targetBVI, 3);
    this.currentSpo2 = smooth(this.currentSpo2, targetSpo2 + noise(0.3), 1);
    this.currentPpgHr = smooth(this.currentPpgHr, this.currentHR + noise(2), 3);

    // Clamp
    this.currentHR = Math.max(30, Math.min(200, this.currentHR));
    this.currentResp = Math.max(8, Math.min(40, this.currentResp));
    this.currentMovement = Math.max(0, Math.min(200, this.currentMovement));
    this.currentBVI = Math.max(0, Math.min(100, this.currentBVI));
    this.currentSpo2 = Math.max(70, Math.min(100, this.currentSpo2));
    ppgSignalQuality = Math.max(0, Math.min(100, ppgSignalQuality));

    // Fusion rule
    let fusedHr = this.currentHR * 0.6 + this.currentPpgHr * 0.4;
    if (!ppgConnected) {
      fusedMethod = 'RULE1';
      fusedHr = this.currentHR;
    } else if (Math.abs(this.currentPpgHr - this.currentHR) > 40) {
      fusedMethod = 'RULE2';
      fusedHr = this.currentHR;
    }

    return {
      heartRate: Math.round(fusedHr * 10) / 10,
      respRate: Math.round(this.currentResp),
      movement: Math.round(this.currentMovement * 10) / 10,
      bvi: Math.round(this.currentBVI),
      ppgHr: Math.round(this.currentPpgHr * 10) / 10,
      ppgSpo2: Math.round(this.currentSpo2),
      ppgSignalQuality,
      ppgConnected,
      radarHr: Math.round(this.currentHR),
      fusedHr: Math.round(fusedHr * 10) / 10,
      fusedMethod,
      targetId,
      alert,
    };
  }
}
