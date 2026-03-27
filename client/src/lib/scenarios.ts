// Guardian Dashboard - Demo Scenario Engine
// Simulates realistic multi-scenario vital sign data for demonstration
// Scenarios: Normal / HR High / Fall / Nocturnal / SpO2 Low / BVI Loop (closed-loop demo)

import type { VitalsData, AlertData } from './types';

export type ScenarioType = 'normal' | 'hr_high' | 'fall' | 'nocturnal' | 'spo2_low' | 'bvi_loop';

export interface ScenarioConfig {
  id: ScenarioType;
  label: string;
  label_zh: string;
  description: string;
  description_zh: string;
  icon: string;
  color: string;
  duration?: number;
  isDemo?: boolean;
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
    id: 'bvi_loop',
    label: 'Full Loop Demo',
    label_zh: '完整闭环演示',
    description: 'BVI drop → Agent patrol → AI chat → Recovery (~85s)',
    description_zh: 'BVI下降→Agent巡检→AI对话→恢复 完整闭环（约85秒）',
    icon: '⟳',
    color: '#6366f1',
    isDemo: true,
  },
  {
    id: 'hr_high',
    label: 'HR Elevated',
    label_zh: '心率偏高',
    description: 'Heart rate elevated 110-130 bpm (alert in ~5s)',
    description_zh: '心率持续偏高 110-130 bpm（约5秒触发报警）',
    icon: '♥',
    color: '#f59e0b',
  },
  {
    id: 'fall',
    label: 'Fall Detected',
    label_zh: '跌倒检测',
    description: 'High movement → stillness → FALL alert (~13s)',
    description_zh: '高体动→静止→跌倒报警（约13秒内触发）',
    icon: '⚠',
    color: '#ef4444',
  },
  {
    id: 'nocturnal',
    label: 'Nocturnal Anomaly',
    label_zh: '夜间异常',
    description: 'Respiratory deviation >20% (alert in ~10s)',
    description_zh: '夜间呼吸频率偏离基线 >20%（约10秒触发）',
    icon: '🌙',
    color: '#8b5cf6',
  },
  {
    id: 'spo2_low',
    label: 'SpO₂ Low',
    label_zh: '血氧偏低',
    description: 'Blood oxygen below 95% (alert in ~8s)',
    description_zh: '血氧饱和度持续低于 95%（约8秒触发）',
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

// BVI Loop phases for closed-loop demonstration
// Phase 1 (0-30 ticks):   Normal active state — BVI 70+
// Phase 2 (30-80 ticks):  Gradual decline — BVI drops to ~25 (sedentary, low activity)
// Phase 3 (80-100 ticks): Agent triggers patrol — BVI ~25, system detects anomaly
// Phase 4 (100-140 ticks): AI conversation — BVI starts recovering after interaction
// Phase 5 (140-200 ticks): Recovery — BVI climbs back to 65+
// Phase 6 (200+ ticks):   Stable normal — loop restarts
export type BviLoopPhase = 'active' | 'declining' | 'patrol_triggered' | 'ai_conversing' | 'recovering' | 'stable';

export class ScenarioEngine {
  private tick = 0;
  private scenario: ScenarioType = 'normal';
  private fallPhase = 0;
  private fallTimer = 0;

  // BVI loop state
  private bviLoopPhase: BviLoopPhase = 'active';
  private bviLoopTimer = 0;
  private patrolAlertFired = false;

  private currentHR = 75;
  private currentResp = 16;
  private currentMovement = 2.5;
  private currentBVI = 65;
  private currentSpo2 = 98;
  private currentPpgHr = 76;

  setScenario(s: ScenarioType) {
    this.scenario = s;
    // 切换场景时重置 tick，确保每次都从头开始
    this.tick = 0;
    if (s === 'fall') {
      this.fallPhase = 1;
      this.fallTimer = 0;
      this.currentMovement = 2.5;
      this.currentHR = 75;
    }
    if (s === 'bvi_loop') {
      this.bviLoopPhase = 'active';
      this.bviLoopTimer = 0;
      this.patrolAlertFired = false;
      this.currentBVI = 72;
      this.currentHR = 75;
      this.currentMovement = 3.5;
    }
    if (s === 'hr_high') {
      this.currentHR = 75; // 从正常心率开始上升
    }
    if (s === 'spo2_low') {
      this.currentSpo2 = 97; // 从正常血氧开始下降
    }
    if (s === 'nocturnal') {
      this.currentResp = 16; // 从正常呼吸率开始异常
    }
  }

  getScenario(): ScenarioType {
    return this.scenario;
  }

  getBviLoopPhase(): BviLoopPhase {
    return this.bviLoopPhase;
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

      case 'bvi_loop':
        this.bviLoopTimer++;
        if (this.bviLoopTimer > 200) {
          // Restart loop
          this.bviLoopPhase = 'active';
          this.bviLoopTimer = 0;
          this.patrolAlertFired = false;
        }

        if (this.bviLoopTimer <= 30) {
          // Phase 1: Active — normal healthy state
          this.bviLoopPhase = 'active';
          targetHR = 76 + Math.sin(this.tick / 60) * 5;
          targetResp = 16 + Math.sin(this.tick / 45) * 1.5;
          targetMovement = 3.5 + Math.sin(this.tick / 80) * 1.5;
          targetBVI = 72 + Math.sin(this.tick / 100) * 8;
          targetSpo2 = 98;
          ppgSignalQuality = 85 + Math.round(noise(5));
        } else if (this.bviLoopTimer <= 80) {
          // Phase 2: Declining — elderly becomes sedentary
          this.bviLoopPhase = 'declining';
          const progress = (this.bviLoopTimer - 30) / 50;
          targetHR = 72 - progress * 5 + noise(2);
          targetResp = 15 + noise(1);
          targetMovement = 3.5 - progress * 3.0 + noise(0.3); // Movement drops
          targetBVI = 72 - progress * 48; // BVI drops from 72 to ~24
          targetSpo2 = 97 + (Math.random() < 0.3 ? 1 : 0);
          ppgSignalQuality = 75 + Math.round(noise(8));
        } else if (this.bviLoopTimer <= 100) {
          // Phase 3: Patrol triggered — BVI low, agent detects anomaly
          this.bviLoopPhase = 'patrol_triggered';
          targetHR = 67 + noise(3);
          targetResp = 14 + noise(1);
          targetMovement = 0.4 + noise(0.2);
          targetBVI = 24 + noise(3);
          targetSpo2 = 97;
          ppgSignalQuality = 72 + Math.round(noise(8));
          if (!this.patrolAlertFired && this.bviLoopTimer === 85) {
            this.patrolAlertFired = true;
            alert = {
              type: 'bvi_low',
              severity: 'Warning',
              message: 'BVI critically low (24/100) — Agent initiating proactive patrol check',
              message_zh: 'BVI 极低（24/100）— Agent 触发主动巡检问候',
              timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            };
          }
        } else if (this.bviLoopTimer <= 140) {
          // Phase 4: AI conversing — interaction in progress, slight improvement
          this.bviLoopPhase = 'ai_conversing';
          const progress = (this.bviLoopTimer - 100) / 40;
          targetHR = 68 + progress * 5 + noise(2);
          targetResp = 14 + progress * 1 + noise(0.5);
          targetMovement = 0.5 + progress * 1.5 + noise(0.3);
          targetBVI = 24 + progress * 20; // Slight BVI improvement during conversation
          targetSpo2 = 97 + (Math.random() < 0.2 ? 1 : 0);
          ppgSignalQuality = 76 + Math.round(noise(6));
        } else {
          // Phase 5 & 6: Recovery → Stable
          const progress = Math.min(1, (this.bviLoopTimer - 140) / 60);
          this.bviLoopPhase = progress >= 1 ? 'stable' : 'recovering';
          targetHR = 73 + progress * 4 + noise(2);
          targetResp = 15 + progress * 1 + noise(0.5);
          targetMovement = 2 + progress * 2 + noise(0.5);
          targetBVI = 44 + progress * 25; // BVI recovers to 65+
          targetSpo2 = 98;
          ppgSignalQuality = 80 + Math.round(noise(6));
        }
        break;

      case 'hr_high':
        targetHR = 118 + Math.sin(this.tick / 30) * 8;
        targetResp = 20 + Math.sin(this.tick / 40) * 2;
        targetMovement = 4 + noise(1);
        targetBVI = 55 + noise(5);
        targetSpo2 = 97 + (Math.random() < 0.3 ? 1 : 0);
        ppgSignalQuality = 75 + Math.round(noise(10));
        // 每 5 tick 触发一次报警，避免每秒刷屏
        if (this.currentHR > 100 && this.tick % 5 === 0) {
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
          // Phase 1: 高体动（跌倒瞬间）— 5 tick 后进入静止期
          targetMovement = 160 + noise(20);
          targetHR = 95 + noise(5);
          targetResp = 22 + noise(2);
          targetBVI = 80;
          targetSpo2 = 97;
          ppgSignalQuality = 60 + Math.round(noise(10));
          if (this.fallTimer > 5) {
            this.fallPhase = 2;
            this.fallTimer = 0;
          }
        } else if (this.fallPhase === 2) {
          // Phase 2: 完全静止（老人倒地不动）— 8 tick 后触发 FALL 报警
          targetMovement = 0.2 + noise(0.1);
          targetHR = 88 + noise(3);
          targetResp = 18 + noise(1);
          targetBVI = 10;
          targetSpo2 = 96;
          ppgSignalQuality = 50 + Math.round(noise(10));
          if (this.fallTimer > 8) {
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
          // Phase 3: 跌倒后恢复期
          targetMovement = 1 + noise(0.5);
          targetHR = 85 + noise(5);
          targetResp = 19 + noise(1);
          targetBVI = 20 + this.fallTimer * 0.5;
          targetSpo2 = 97;
          ppgSignalQuality = 70 + Math.round(noise(8));
          if (this.fallTimer > 20) {
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
        // 每 10 tick 触发一次，避免报警刷屏
        if (this.tick % 10 === 0) {
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
        // 每 8 tick 触发一次，避免报警刷屏
        if (this.currentSpo2 < 95 && this.tick % 8 === 0) {
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
