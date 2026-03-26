// Guardian Dashboard - Data Types
// Active Elderly Companion System

export interface VitalsData {
  timestamp: string;
  radar_hr: number;
  radar_resp: number;
  movement: number;
  fused_hr: number;
  ppg_hr: number;
  ppg_spo2: number;
  ppg_quality: number;
  ppg_status: 'ACTIVE' | 'NO-SIGNAL' | 'WARMING';
  bvi: number;
  target_id: 'human' | 'pet' | 'none';
  fusion_rule: 'RULE1' | 'RULE2' | 'RULE3' | 'RULE4';
  alert: AlertData | null;
}

export interface AlertData {
  type: 'fall' | 'hr_high' | 'hr_low' | 'spo2_low' | 'bvi_low' | 'nocturnal' | 'FALL DETECTED';
  severity: 'Critical' | 'Warning' | 'Info';
  message: string;
  message_zh: string;
  timestamp: string;
  acknowledged?: boolean;
  filtered_by_pet?: boolean;
}

export interface BVIDataPoint {
  time: string;
  bvi: number;
  active: boolean;
}

export interface ConversationMessage {
  id: string;
  role: 'ai' | 'user' | 'system';
  content: string;
  content_zh?: string;
  timestamp: string;
  type?: 'patrol' | 'alert_response' | 'daily_report' | 'conversation' | 'nocturnal';
}

export interface AgentWorkflowStep {
  step: string;
  status: 'completed' | 'running' | 'pending';
  detail?: string;
  timestamp?: string;
}

export type PageType = 'live' | 'vitality' | 'alerts' | 'companion' | 'report';

export interface DemoState {
  enabled: boolean;
  baseHr: number;
  hrPhase: number;
  respPhase: number;
  movementPhase: number;
  bviPhase: number;
  tick: number;
}
