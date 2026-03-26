// Guardian Dashboard - MQTT WebSocket Hook
// Connects to Jetson Nano MQTT Broker via WebSocket
// Topic: companion/status | Format: JSON VitalsData

import { useState, useEffect, useRef, useCallback } from 'react';
import mqtt, { MqttClient } from 'mqtt';
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

export function useMqtt(): UseMqttReturn {
  const [status, setStatus] = useState<MqttConnectionStatus>('disconnected');
  const [lastData, setLastData] = useState<VitalsData | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const clientRef = useRef<MqttClient | null>(null);
  const configRef = useRef<MqttConfig | null>(null);

  const disconnect = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.end(true);
      clientRef.current = null;
    }
    setStatus('disconnected');
  }, []);

  const connect = useCallback((config: MqttConfig) => {
    // Disconnect existing connection
    if (clientRef.current) {
      clientRef.current.end(true);
      clientRef.current = null;
    }

    configRef.current = config;
    setStatus('connecting');
    setLastError(null);

    try {
      const client = mqtt.connect(config.brokerUrl, {
        username: config.username,
        password: config.password,
        reconnectPeriod: 5000,
        connectTimeout: 10000,
        keepalive: 30,
        clientId: `guardian-dashboard-${Math.random().toString(16).slice(2, 8)}`,
      });

      client.on('connect', () => {
        setStatus('connected');
        setLastError(null);
        client.subscribe(config.topic, { qos: 0 }, (err) => {
          if (err) {
            setLastError(`Subscribe failed: ${err.message}`);
          }
        });
      });

      client.on('message', (_topic: string, payload: Buffer) => {
        try {
          const data = JSON.parse(payload.toString()) as VitalsData;
          setLastData(data);
        } catch (e) {
          console.warn('Failed to parse MQTT message:', e);
        }
      });

      client.on('error', (err: Error) => {
        setStatus('error');
        setLastError(err.message);
      });

      client.on('close', () => {
        setStatus('disconnected');
      });

      client.on('reconnect', () => {
        setStatus('connecting');
      });

      clientRef.current = client;
    } catch (e) {
      setStatus('error');
      setLastError(e instanceof Error ? e.message : 'Connection failed');
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (clientRef.current) {
        clientRef.current.end(true);
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
