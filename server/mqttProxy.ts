// Guardian Dashboard - MQTT WebSocket Proxy
// Bridges browser (wss://) ↔ Jetson Nano MQTT Broker (ws://)
// Solves: HTTPS pages cannot connect to insecure ws:// directly

import { Server as HttpServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import mqtt from "mqtt";

interface MqttProxyConfig {
  brokerUrl: string;   // e.g. ws://192.168.1.100:9001
  topic: string;       // e.g. companion/status
  username?: string;
  password?: string;
}

// Store active proxy connections: clientId → { browser ws, mqtt client }
const activeProxies = new Map<string, { mqttClient: mqtt.MqttClient; browserWs: WebSocket }>();

export function setupMqttProxy(server: HttpServer) {
  const wss = new WebSocketServer({ server, path: "/ws/mqtt-proxy" });

  console.log("[MQTT Proxy] WebSocket proxy server ready at /ws/mqtt-proxy");

  wss.on("connection", (browserWs) => {
    const clientId = `proxy-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    console.log(`[MQTT Proxy] Browser client connected: ${clientId}`);

    let mqttClient: mqtt.MqttClient | null = null;

    // Send status message to browser
    const sendStatus = (type: string, payload: Record<string, unknown>) => {
      if (browserWs.readyState === WebSocket.OPEN) {
        browserWs.send(JSON.stringify({ _type: type, ...payload }));
      }
    };

    // Handle messages from browser
    browserWs.on("message", (raw: Buffer | string) => {
      try {
        const msg = JSON.parse(raw.toString());

        if (msg.action === "connect") {
          // Browser wants to connect to a MQTT broker
          const config: MqttProxyConfig = {
            brokerUrl: msg.brokerUrl || "ws://localhost:9001",
            topic: msg.topic || "companion/status",
            username: msg.username,
            password: msg.password,
          };

          console.log(`[MQTT Proxy] ${clientId} connecting to ${config.brokerUrl} topic=${config.topic}`);

          // Disconnect existing MQTT client if any
          if (mqttClient) {
            mqttClient.end(true);
            mqttClient = null;
          }

          sendStatus("connecting", { brokerUrl: config.brokerUrl });

          try {
            mqttClient = mqtt.connect(config.brokerUrl, {
              clientId: `guardian-proxy-${clientId}`,
              username: config.username,
              password: config.password,
              connectTimeout: 8000,
              reconnectPeriod: 3000,
              keepalive: 30,
            });

            mqttClient.on("connect", () => {
              console.log(`[MQTT Proxy] ${clientId} connected to broker`);
              mqttClient!.subscribe(config.topic, { qos: 0 }, (err) => {
                if (err) {
                  sendStatus("error", { message: `Subscribe failed: ${err.message}` });
                } else {
                  sendStatus("connected", { brokerUrl: config.brokerUrl, topic: config.topic });
                }
              });
            });

            mqttClient.on("message", (topic, payload) => {
              // Forward MQTT message to browser
              if (browserWs.readyState === WebSocket.OPEN) {
                try {
                  const data = JSON.parse(payload.toString());
                  browserWs.send(JSON.stringify({ _type: "data", topic, data }));
                } catch {
                  // Not JSON, send raw
                  browserWs.send(JSON.stringify({ _type: "data", topic, raw: payload.toString() }));
                }
              }
            });

            mqttClient.on("error", (err) => {
              console.error(`[MQTT Proxy] ${clientId} MQTT error:`, err.message);
              sendStatus("error", { message: err.message });
            });

            mqttClient.on("close", () => {
              console.log(`[MQTT Proxy] ${clientId} MQTT connection closed`);
              sendStatus("disconnected", {});
            });

            mqttClient.on("reconnect", () => {
              sendStatus("reconnecting", {});
            });

            activeProxies.set(clientId, { mqttClient, browserWs });

          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            sendStatus("error", { message: `Connection failed: ${message}` });
          }

        } else if (msg.action === "disconnect") {
          if (mqttClient) {
            mqttClient.end(true);
            mqttClient = null;
          }
          sendStatus("disconnected", {});
        }

      } catch (err) {
        console.error(`[MQTT Proxy] ${clientId} message parse error:`, err);
      }
    });

    // Clean up when browser disconnects
    browserWs.on("close", () => {
      console.log(`[MQTT Proxy] Browser client disconnected: ${clientId}`);
      if (mqttClient) {
        mqttClient.end(true);
        mqttClient = null;
      }
      activeProxies.delete(clientId);
    });

    browserWs.on("error", (err: Error) => {
      console.error(`[MQTT Proxy] ${clientId} browser WS error:`, err.message);
    });

    // Send initial ready message
    sendStatus("ready", { message: "MQTT proxy ready" });
  });

  return wss;
}
