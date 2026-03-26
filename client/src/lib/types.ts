// Guardian Dashboard - Data Types
// Active Elderly Companion System

export interface VitalsData {
  // Heart rate (fused result from radar + PPG)
  heartRate: number;
  // Respiration rate from radar
  respRate: number;
  // Body movement intensity
  movement: number;
  // Body Vitality Index
  bvi: number;
  // PPG sensor data
  ppgHr?: number;
  ppgSpo2?: number;
  ppgSignalQuality?: number;
  ppgConnected?: boolean;
  // Raw radar HR
  radarHr?: number;
  // Fused HR (same as heartRate, kept for clarity)
  fusedHr?: number;
  // Fusion method description
  fusedMethod?: string;
  // CA1 target ID
  targetId?: string;
  // Alert generated this tick
  alert: AlertData | null;
}

export interface AlertData {
  type: string;
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
  id?: string;
  role: 'ai' | 'user' | 'system' | 'assistant';
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
