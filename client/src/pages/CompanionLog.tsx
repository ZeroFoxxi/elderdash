// Guardian Dashboard - AI Companion Log Page
// Dialogue history, patrol logs, and agent workflow

import { useState } from 'react';
import { Bot, User, Settings, ChevronDown, ChevronUp, Mic, Send, Activity, AlertTriangle, Moon, Clock } from 'lucide-react';
import { useDashboard } from '../contexts/DashboardContext';
import type { ConversationMessage } from '../lib/types';
import { DEMO_WORKFLOW_STEPS } from '../lib/demo';

function getMessageTypeIcon(type: ConversationMessage['type']) {
  switch (type) {
    case 'patrol': return <Clock size={10} className="text-teal-500" />;
    case 'alert_response': return <AlertTriangle size={10} className="text-amber-500" />;
    case 'nocturnal': return <Moon size={10} className="text-blue-400" />;
    default: return null;
  }
}

function getMessageTypeBadge(type: ConversationMessage['type'], isEnglish: boolean) {
  const labels: Record<string, [string, string]> = {
    patrol: ['Patrol', '巡检'],
    alert_response: ['Alert Response', '报警响应'],
    nocturnal: ['Nocturnal', '夜间'],
    daily_report: ['Daily Report', '日报'],
    conversation: ['Conversation', '对话'],
  };
  if (!type || !labels[type]) return null;
  const label = isEnglish ? labels[type][0] : labels[type][1];
  const colors: Record<string, string> = {
    patrol: 'bg-teal-50 text-teal-600 border-teal-200',
    alert_response: 'bg-amber-50 text-amber-600 border-amber-200',
    nocturnal: 'bg-blue-50 text-blue-600 border-blue-200',
    daily_report: 'bg-purple-50 text-purple-600 border-purple-200',
    conversation: 'bg-gray-50 text-gray-600 border-gray-200',
  };
  return (
    <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded border ${colors[type] ?? colors.conversation}`}>
      {label}
    </span>
  );
}

export default function CompanionLog() {
  const { conversations, isEnglish, isDemoMode } = useDashboard();
  const [workflowExpanded, setWorkflowExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'patrol' | 'alert' | 'nocturnal'>('all');

  const filtered = conversations.filter(msg => {
    if (activeTab === 'all') return true;
    if (activeTab === 'patrol') return msg.type === 'patrol';
    if (activeTab === 'alert') return msg.type === 'alert_response';
    if (activeTab === 'nocturnal') return msg.type === 'nocturnal';
    return true;
  });

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      {/* Header */}
      <div>
        <div className="flex items-baseline gap-2">
          <h2 className="text-xl font-semibold text-foreground">
            {isEnglish ? 'AI Companion Log' : 'AI 陪伴日志'}
          </h2>
          <span className="text-sm text-muted-foreground font-normal">Companion Log</span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {isEnglish ? 'Proactive · Dialogue · Daily Report' : 'Proactive · Dialogue · Daily Report'}
        </p>
      </div>

      {/* Agent Workflow */}
      <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
        <button
          onClick={() => setWorkflowExpanded(prev => !prev)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Bot size={15} className="text-primary" />
            <span className="text-sm font-semibold text-foreground">
              {isEnglish ? 'Agent Workflow' : 'Agent 工作流程'}
            </span>
            <span className="text-xs text-muted-foreground">(Click to expand)</span>
          </div>
          {workflowExpanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
        </button>

        {workflowExpanded && (
          <div className="px-4 pb-4 border-t border-border">
            <div className="mt-3 space-y-2">
              {DEMO_WORKFLOW_STEPS.map((step, i) => (
                <div key={i} className="flex items-start gap-3">
                  {/* Status indicator */}
                  <div className="mt-1 flex-shrink-0">
                    {step.status === 'completed' && (
                      <div className="w-4 h-4 rounded-full bg-emerald-100 flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      </div>
                    )}
                    {step.status === 'running' && (
                      <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-primary live-dot" />
                      </div>
                    )}
                    {step.status === 'pending' && (
                      <div className="w-4 h-4 rounded-full bg-muted flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium ${step.status === 'pending' ? 'text-muted-foreground' : 'text-foreground'}`}>
                        {step.step}
                      </span>
                      {step.timestamp && (
                        <span className="text-[10px] text-muted-foreground font-mono">{step.timestamp}</span>
                      )}
                      {step.status === 'running' && (
                        <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">
                          {isEnglish ? 'Running' : '运行中'}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground">{step.detail}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* System Info */}
            <div className="mt-4 pt-3 border-t border-border grid grid-cols-3 gap-3 text-[10px] text-muted-foreground">
              <div>
                <div className="font-medium text-foreground mb-0.5">LLM</div>
                <div>Qwen-Turbo (Cloud)</div>
                <div>Offline: Qwen2.5-0.5B</div>
              </div>
              <div>
                <div className="font-medium text-foreground mb-0.5">TTS</div>
                <div>Local pyttsx3</div>
                <div>Online: Edge-TTS</div>
              </div>
              <div>
                <div className="font-medium text-foreground mb-0.5">Patrol</div>
                <div>BVI-driven hourly</div>
                <div>Alert: immediate</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2">
        {[
          { id: 'all', label: isEnglish ? 'All' : '全部' },
          { id: 'patrol', label: isEnglish ? 'Patrol' : '巡检' },
          { id: 'alert', label: isEnglish ? 'Alert Response' : '报警响应' },
          { id: 'nocturnal', label: isEnglish ? 'Nocturnal' : '夜间' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === tab.id ? 'bg-primary text-primary-foreground' : 'bg-white border border-border text-muted-foreground hover:bg-muted'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Conversation Log */}
      <div className="bg-white rounded-xl border border-border shadow-sm">
        {!isDemoMode && conversations.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <Bot size={20} className="text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              {isEnglish ? 'No Conversation Logs' : '暂无对话记录'}
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              {isEnglish ? 'Conversations from Jetson Nano will appear here' : 'Jetson Nano 的对话记录将在此显示'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map(msg => (
              <div key={msg.id} className={`px-4 py-3 ${msg.role === 'system' ? 'bg-muted/30' : ''}`}>
                {msg.role === 'system' ? (
                  <div className="flex items-center gap-2">
                    <Settings size={11} className="text-muted-foreground" />
                    <span className="text-[11px] text-muted-foreground italic">
                      {isEnglish ? msg.content : (msg.content_zh ?? msg.content)}
                    </span>
                    <span className="text-[10px] text-muted-foreground/50 font-mono ml-auto">{msg.timestamp}</span>
                  </div>
                ) : (
                  <div className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    {/* Avatar */}
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                      msg.role === 'ai' ? 'bg-primary/10' : 'bg-muted'
                    }`}>
                      {msg.role === 'ai' ? <Bot size={14} className="text-primary" /> : <User size={14} className="text-muted-foreground" />}
                    </div>
                    {/* Bubble */}
                    <div className={`flex-1 max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                      <div className="flex items-center gap-2">
                        {msg.role === 'ai' && (
                          <span className="text-[11px] font-medium text-primary">
                            {isEnglish ? 'AI Guardian' : 'AI 守护者'}
                          </span>
                        )}
                        {msg.type && getMessageTypeBadge(msg.type, isEnglish)}
                        {msg.type && getMessageTypeIcon(msg.type)}
                        <span className="text-[10px] text-muted-foreground font-mono">{msg.timestamp}</span>
                      </div>
                      <div className={`px-3 py-2 rounded-xl text-xs leading-relaxed ${
                        msg.role === 'ai'
                          ? 'bg-muted text-foreground rounded-tl-sm'
                          : 'bg-primary text-primary-foreground rounded-tr-sm'
                      }`}>
                        {isEnglish ? msg.content : (msg.content_zh ?? msg.content)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Voice Patrol Trigger */}
      <div className="bg-white rounded-xl p-4 border border-border shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">
              {isEnglish ? 'Manual Patrol Trigger' : '手动触发巡检'}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isEnglish ? 'Trigger a proactive voice check-in' : '触发一次主动语音问候'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors">
              <Mic size={13} />
              {isEnglish ? 'Voice Patrol' : '语音巡检'}
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-muted text-foreground rounded-lg text-xs font-medium hover:bg-muted/80 transition-colors">
              <Send size={13} />
              {isEnglish ? 'Text Message' : '文字消息'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
