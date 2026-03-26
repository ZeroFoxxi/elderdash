// Guardian Dashboard - MQTT Hook (via Backend Proxy)
// Browser connects to our backend via wss:// (secure)
// Backend connects to Jetson Nano via ws:// (local network)
// This bypasses the "insecure WebSocket from HTTPS page" browser restriction

import { useState, useEffect, useRef, useCallback } from 'react';
import type { VitalsData } from '../lib/types';

export type MqttConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface MqttConfig {
  brokerUrl: string;   // e.g. "ws://192.168.1.100:9001"
  topic: string;       // e.g. "companion/status"
  username?: string;
  password?: string;
}

export interface UseMqttReturn {
  status: MqttConnectionStatus;
  lastData: VitalsData | null;
  lastError: string | null;
  connect: (config: MqttConfig) => void;
  disconnect: () => void;
  isConnected: boolean;
}

// Build the proxy URL: same host as the dashboard, /ws/mqtt-proxy path
function getProxyUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  return `${protocol}//${host}/ws/mqtt-proxy`;
}

export function useMqtt(): UseMqttReturn {
  const [status, setStatus] = useState<MqttConnectionStatus>('disconnected');
  const [lastData, setLastData] = useState<VitalsData | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const pendingConfigRef = useRef<MqttConfig | null>(null);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      try {
        wsRef.current.send(JSON.stringify({ action: 'disconnect' }));
        wsRef.current.close();
      } catch { /* ignore */ }
      wsRef.current = null;
    }
    setStatus('disconnected');
  }, []);

  const connect = useCallback((config: MqttConfig) => {
    // Disconnect existing connection
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch { /* ignore */ }
      wsRef.current = null;
    }

    setStatus('connecting');
    setLastError(null);
    pendingConfigRef.current = config;

    const proxyUrl = getProxyUrl();
    console.log('[MQTT Hook] Connecting via proxy:', proxyUrl, '→', config.brokerUrl);

    let ws: WebSocket;
    try {
      ws = new WebSocket(proxyUrl);
    } catch (err) {
      setStatus('error');
      setLastError(`Cannot open proxy connection: ${err}`);
      return;
    }

    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[MQTT Hook] Proxy WebSocket open, sending connect request...');
      ws.send(JSON.stringify({
        action: 'connect',
        brokerUrl: config.brokerUrl,
        topic: config.topic,
        username: config.username,
        password: config.password,
      }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string);

        switch (msg._type) {
          case 'ready':
            // Proxy ready - connection request already sent in onopen
            break;

          case 'connecting':
            setStatus('connecting');
            break;

          case 'connected':
            console.log('[MQTT Hook] MQTT broker connected!');
            setStatus('connected');
            setLastError(null);
            break;

          case 'disconnected':
            setStatus('disconnected');
            break;

          case 'reconnecting':
            setStatus('connecting');
            break;

          case 'error':
            console.error('[MQTT Hook] Error:', msg.message);
            setStatus('error');
            setLastError(msg.message || 'Unknown MQTT error');
            break;

          case 'data':
            if (msg.data) {
              setLastData(msg.data as VitalsData);
            }
            break;
        }
      } catch (err) {
        console.error('[MQTT Hook] Message parse error:', err);
      }
    };

    ws.onerror = () => {
      setStatus('error');
      setLastError('Failed to connect to proxy server. Check that the dashboard server is running.');
    };

    ws.onclose = () => {
      console.log('[MQTT Hook] Proxy connection closed');
      if (wsRef.current === ws) {
        wsRef.current = null;
        setStatus('disconnected');
      }
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        try { wsRef.current.close(); } catch { /* ignore */ }
        wsRef.current = null;
      }
    };
  }, []);

  return {
    status,
    lastData,
    lastError,
    connect,
    disconnect,
    isConnected: status === 'connected',
  };
}
