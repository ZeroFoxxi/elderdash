// Guardian Dashboard - AI Companion Voice Chat Page
// Browser microphone → Whisper transcription → Qwen AI reply → TTS playback
// Also shows conversation history from Jetson Nano

import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, MicOff, Send, Bot, User, Volume2, VolumeX, Loader2, Clock, AlertTriangle, Moon, ChevronDown, ChevronUp, Settings, Trash2 } from 'lucide-react';
import { useDashboard } from '../contexts/DashboardContext';
import { trpc } from '../lib/trpc';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  type?: 'chat' | 'patrol' | 'alert_response' | 'nocturnal';
  source?: 'browser' | 'jetson';
};

// ─── TTS Helper ───────────────────────────────────────────────────────────────

function speakText(text: string, lang = 'zh-CN') {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = 0.9;
  utterance.pitch = 1.05;
  // Prefer a female Chinese voice
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(v => v.lang.startsWith('zh') && v.name.toLowerCase().includes('female'))
    ?? voices.find(v => v.lang.startsWith('zh'))
    ?? null;
  if (preferred) utterance.voice = preferred;
  window.speechSynthesis.speak(utterance);
}

// ─── Workflow Steps (static display) ─────────────────────────────────────────

const WORKFLOW_STEPS = [
  { step: '1. 传感器数据采集', detail: '雷达 R60ABD1 + PPG STM32 持续监测', status: 'completed' as const },
  { step: '2. BVI 活力指数计算', detail: '基于心率、呼吸、体动的综合评分', status: 'completed' as const },
  { step: '3. 主动巡检触发', detail: 'BVI < 40 或超过1小时未互动时触发', status: 'running' as const },
  { step: '4. Qwen AI 生成回复', detail: '云端 Qwen-Turbo 生成关怀性语言', status: 'running' as const },
  { step: '5. TTS 语音播报', detail: '本地 pyttsx3 / 云端 Edge-TTS 播放', status: 'pending' as const },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CompanionLog() {
  const { isEnglish, conversations } = useDashboard();

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTtsEnabled, setIsTtsEnabled] = useState(true);
  const [workflowExpanded, setWorkflowExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'history'>('chat');

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Scroll ref
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // tRPC mutations
  const chatMutation = trpc.companion.chat.useMutation({
    onSuccess: (data) => {
      const assistantMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: data.reply,
        timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }),
        type: 'chat',
        source: 'browser',
      };
      setMessages(prev => [...prev, assistantMsg]);
      if (isTtsEnabled) speakText(data.reply);
    },
    onError: (err) => {
      toast.error(isEnglish ? 'AI reply failed' : 'AI 回复失败：' + err.message);
    },
  });

  const transcribeMutation = trpc.companion.transcribeAudio.useMutation({
    onSuccess: (data) => {
      if (data.text) {
        setInputText(data.text);
        // Auto-send after transcription
        sendMessage(data.text);
      }
    },
    onError: (err) => {
      toast.error(isEnglish ? 'Transcription failed' : '语音识别失败：' + err.message);
    },
  });

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initialize with welcome message
  useEffect(() => {
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: isEnglish
        ? "Hello! I'm Xiao An, your AI companion. I can chat with you, remind you to take medicine, and check on your health. How are you feeling today? 😊"
        : "您好！我是小安，您的智能陪伴助手～就像邻家的小女儿，陪您说说话、聊聊天、提醒吃药、关注健康。您今天感觉怎么样？😊",
      timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }),
      type: 'chat',
      source: 'browser',
    }]);
  }, [isEnglish]);

  // ─── Send message ──────────────────────────────────────────────────────────

  const sendMessage = useCallback((text?: string) => {
    const content = (text ?? inputText).trim();
    if (!content || chatMutation.isPending) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }),
      type: 'chat',
      source: 'browser',
    };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');

    // Build history for context (last 8 messages)
    const history = messages.slice(-8).map(m => ({ role: m.role, content: m.content }));
    chatMutation.mutate({ message: content, history });
  }, [inputText, messages, chatMutation, isTtsEnabled]);

  // ─── Voice recording ───────────────────────────────────────────────────────

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const recorder = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        if (blob.size < 1000) {
          toast.warning(isEnglish ? 'Recording too short' : '录音太短，请重试');
          return;
        }
        // Convert to base64
        setIsTranscribing(true);
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          transcribeMutation.mutate({
            audioBase64: base64,
            mimeType: mimeType.split(';')[0],
            language: isEnglish ? 'en' : 'zh',
          });
          setIsTranscribing(false);
        };
        reader.readAsDataURL(blob);
      };

      recorder.start(100);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingSeconds(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds(s => {
          if (s >= 59) {
            stopRecording();
            return 0;
          }
          return s + 1;
        });
      }, 1000);
    } catch (err) {
      toast.error(isEnglish ? 'Microphone access denied' : '无法访问麦克风，请检查浏览器权限');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setIsRecording(false);
    setRecordingSeconds(0);
  };

  const toggleRecording = () => {
    if (isRecording) stopRecording();
    else startRecording();
  };

  const clearChat = () => {
    window.speechSynthesis?.cancel();
    setMessages([{
      id: 'welcome-new',
      role: 'assistant',
      content: isEnglish ? "Chat cleared. How can I help you?" : "对话已清空，有什么我可以帮您的吗？",
      timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }),
      type: 'chat',
      source: 'browser',
    }]);
  };

  const isLoading = chatMutation.isPending || transcribeMutation.isPending || isTranscribing;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 overflow-hidden flex flex-col p-4 gap-3">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <div className="flex items-baseline gap-2">
            <h2 className="text-lg font-semibold text-foreground">
              {isEnglish ? 'AI Companion' : '小安语音助手'}
            </h2>
            <span className="text-xs text-muted-foreground">Xiao An · Powered by Qwen</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {isEnglish ? 'Click the mic to speak · Text input also supported' : '点击麦克风说话 · 也可文字输入'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* TTS toggle */}
          <button
            onClick={() => { setIsTtsEnabled(v => !v); window.speechSynthesis?.cancel(); }}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border ${
              isTtsEnabled
                ? 'bg-primary/10 text-primary border-primary/30'
                : 'bg-muted text-muted-foreground border-border'
            }`}
            title={isTtsEnabled ? (isEnglish ? 'TTS On' : '语音播报已开启') : (isEnglish ? 'TTS Off' : '语音播报已关闭')}
          >
            {isTtsEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
            <span>{isTtsEnabled ? (isEnglish ? 'TTS On' : '播报') : (isEnglish ? 'TTS Off' : '静音')}</span>
          </button>
          {/* Clear chat */}
          <button
            onClick={clearChat}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-muted text-muted-foreground border border-border hover:bg-muted/80 transition-all"
          >
            <Trash2 size={12} />
            {isEnglish ? 'Clear' : '清空'}
          </button>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 flex-shrink-0">
        {[
          { id: 'chat', label: isEnglish ? 'Voice Chat' : '语音对话' },
          { id: 'history', label: isEnglish ? 'Jetson Log' : 'Jetson 日志' },
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

      {activeTab === 'chat' ? (
        <>
          {/* Chat messages area */}
          <div className="flex-1 overflow-y-auto bg-white rounded-xl border border-border shadow-sm min-h-0">
            <div className="p-4 space-y-4">
              {messages.map(msg => (
                <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  {/* Avatar */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    msg.role === 'assistant' ? 'bg-primary/10' : 'bg-muted'
                  }`}>
                    {msg.role === 'assistant'
                      ? <Bot size={15} className="text-primary" />
                      : <User size={15} className="text-muted-foreground" />
                    }
                  </div>
                  {/* Bubble */}
                  <div className={`max-w-[75%] flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className="flex items-center gap-2">
                      {msg.role === 'assistant' && (
                        <span className="text-[11px] font-semibold text-primary">小安</span>
                      )}
                      <span className="text-[10px] text-muted-foreground font-mono">{msg.timestamp}</span>
                    </div>
                    <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                      msg.role === 'assistant'
                        ? 'bg-muted text-foreground rounded-tl-sm'
                        : 'bg-primary text-primary-foreground rounded-tr-sm'
                    }`}>
                      {msg.content}
                    </div>
                    {/* TTS replay button for assistant */}
                    {msg.role === 'assistant' && isTtsEnabled && (
                      <button
                        onClick={() => speakText(msg.content)}
                        className="text-[10px] text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
                      >
                        <Volume2 size={10} />
                        {isEnglish ? 'Replay' : '重播'}
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {/* Loading indicator */}
              {isLoading && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Bot size={15} className="text-primary" />
                  </div>
                  <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
                    <Loader2 size={13} className="animate-spin text-primary" />
                    <span className="text-xs text-muted-foreground">
                      {isTranscribing || transcribeMutation.isPending
                        ? (isEnglish ? 'Transcribing...' : '正在识别语音...')
                        : (isEnglish ? 'Thinking...' : '小安正在思考...')}
                    </span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input area */}
          <div className="flex-shrink-0 bg-white rounded-xl border border-border shadow-sm p-3">
            {/* Recording status bar */}
            {isRecording && (
              <div className="flex items-center gap-2 mb-2 px-1">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-xs text-red-500 font-medium">
                  {isEnglish ? `Recording ${recordingSeconds}s (max 60s)` : `录音中 ${recordingSeconds}s（最长60秒）`}
                </span>
                <span className="text-xs text-muted-foreground ml-auto">
                  {isEnglish ? 'Click mic again to stop' : '再次点击麦克风停止'}
                </span>
              </div>
            )}

            <div className="flex items-end gap-2">
              {/* Mic button */}
              <button
                onClick={toggleRecording}
                disabled={isLoading && !isRecording}
                className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                  isRecording
                    ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/30 scale-110'
                    : 'bg-primary/10 hover:bg-primary/20 text-primary'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
                title={isRecording ? (isEnglish ? 'Stop recording' : '停止录音') : (isEnglish ? 'Start recording' : '开始录音')}
              >
                {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
              </button>

              {/* Text input */}
              <div className="flex-1 relative">
                <textarea
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder={isRecording
                    ? (isEnglish ? 'Recording... click mic to stop' : '录音中...点击麦克风停止')
                    : (isEnglish ? 'Type a message or click mic to speak...' : '输入消息，或点击麦克风说话...')}
                  className="w-full resize-none rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 min-h-[40px] max-h-[100px]"
                  rows={1}
                  disabled={isRecording}
                />
              </div>

              {/* Send button */}
              <button
                onClick={() => sendMessage()}
                disabled={!inputText.trim() || isLoading}
                className="flex-shrink-0 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send size={16} />
              </button>
            </div>

            {/* Quick prompts */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {(isEnglish
                ? ["How are you?", "Remind me to take medicine", "Tell me a story", "What's the weather?"]
                : ["今天感觉怎么样？", "提醒我吃药", "讲个故事", "今天天气怎么样？"]
              ).map(prompt => (
                <button
                  key={prompt}
                  onClick={() => sendMessage(prompt)}
                  disabled={isLoading}
                  className="px-2.5 py-1 rounded-full text-[11px] bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary border border-border transition-all disabled:opacity-40"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        </>
      ) : (
        /* History tab - Jetson conversation logs */
        <div className="flex-1 overflow-y-auto space-y-3 min-h-0">
          {/* Agent Workflow */}
          <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
            <button
              onClick={() => setWorkflowExpanded(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Settings size={13} className="text-primary" />
                <span className="text-sm font-semibold text-foreground">
                  {isEnglish ? 'Agent Workflow' : 'Agent 工作流程'}
                </span>
              </div>
              {workflowExpanded ? <ChevronUp size={13} className="text-muted-foreground" /> : <ChevronDown size={13} className="text-muted-foreground" />}
            </button>
            {workflowExpanded && (
              <div className="px-4 pb-4 border-t border-border space-y-2 mt-3">
                {WORKFLOW_STEPS.map((step, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="mt-1 flex-shrink-0">
                      {step.status === 'completed' && (
                        <div className="w-4 h-4 rounded-full bg-emerald-100 flex items-center justify-center">
                          <div className="w-2 h-2 rounded-full bg-emerald-500" />
                        </div>
                      )}
                      {step.status === 'running' && (
                        <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center">
                          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                        </div>
                      )}
                      {step.status === 'pending' && (
                        <div className="w-4 h-4 rounded-full bg-muted flex items-center justify-center">
                          <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
                        </div>
                      )}
                    </div>
                    <div>
                      <p className={`text-xs font-medium ${step.status === 'pending' ? 'text-muted-foreground' : 'text-foreground'}`}>{step.step}</p>
                      <p className="text-[10px] text-muted-foreground">{step.detail}</p>
                    </div>
                  </div>
                ))}
                <div className="mt-3 pt-3 border-t border-border grid grid-cols-3 gap-3 text-[10px] text-muted-foreground">
                  <div><div className="font-medium text-foreground mb-0.5">LLM</div><div>Qwen-Turbo (Cloud)</div></div>
                  <div><div className="font-medium text-foreground mb-0.5">TTS</div><div>Browser Speech API</div></div>
                  <div><div className="font-medium text-foreground mb-0.5">STT</div><div>Whisper (Cloud)</div></div>
                </div>
              </div>
            )}
          </div>

          {/* Jetson conversation logs */}
          <div className="bg-white rounded-xl border border-border shadow-sm">
            {conversations.length === 0 ? (
              <div className="p-10 flex flex-col items-center text-center">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-3">
                  <Bot size={18} className="text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">
                  {isEnglish ? 'No Jetson Logs' : '暂无 Jetson 日志'}
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  {isEnglish ? 'Conversations from Jetson Nano will appear here' : 'Jetson Nano 的对话记录将在此显示'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {conversations.map((msg, i) => (
                  <div key={msg.id ?? i} className={`px-4 py-3 ${msg.role === 'system' ? 'bg-muted/30' : ''}`}>
                    {msg.role === 'system' ? (
                      <div className="flex items-center gap-2">
                        <Settings size={10} className="text-muted-foreground" />
                        <span className="text-[11px] text-muted-foreground italic">{msg.content}</span>
                        <span className="text-[10px] text-muted-foreground/50 font-mono ml-auto">{msg.timestamp}</span>
                      </div>
                    ) : (
                      <div className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'ai' ? 'bg-primary/10' : 'bg-muted'}`}>
                          {msg.role === 'ai' ? <Bot size={13} className="text-primary" /> : <User size={13} className="text-muted-foreground" />}
                        </div>
                        <div className={`flex-1 max-w-[80%] flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                          <div className="flex items-center gap-2">
                            {msg.role === 'ai' && <span className="text-[11px] font-medium text-primary">Jetson AI</span>}
                            {msg.type && msg.type !== 'conversation' && (
                              <span className={`text-[9px] px-1.5 py-0.5 rounded border font-medium ${
                                msg.type === 'patrol' ? 'bg-teal-50 text-teal-600 border-teal-200'
                                : msg.type === 'alert_response' ? 'bg-amber-50 text-amber-600 border-amber-200'
                                : 'bg-blue-50 text-blue-600 border-blue-200'
                              }`}>
                                {msg.type === 'patrol' ? (isEnglish ? 'Patrol' : '巡检')
                                : msg.type === 'alert_response' ? (isEnglish ? 'Alert' : '报警响应')
                                : (isEnglish ? 'Nocturnal' : '夜间')}
                              </span>
                            )}
                            <span className="text-[10px] text-muted-foreground font-mono">{msg.timestamp}</span>
                          </div>
                          <div className={`px-3 py-2 rounded-xl text-xs leading-relaxed ${
                            msg.role === 'ai' ? 'bg-muted text-foreground rounded-tl-sm' : 'bg-primary text-primary-foreground rounded-tr-sm'
                          }`}>
                            {msg.content}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
