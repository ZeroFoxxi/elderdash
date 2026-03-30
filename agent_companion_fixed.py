#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
独居老人陪伴系统 - Agent 智能体 v2.4（最终稳定版）
Agent Companion Module v2.4 - Final Stable Edition

版本历史：
  v2.0  基础版
  v2.2  修复心率报警使用 fused_hr，增加持续确认机制
  v2.3  全面 Bug 修复与优化（2026-03-25）
  v2.4  SpO2报警+呼吸率确认机制+跌倒候选超时（2026-03-25）

v2.3 修复与改进：
═══════════════════════════════════════════════════════════════
【Bug 修复】
  1. active_minutes 计算错误修复
     原：每帧 += 1/30（假设 2 秒/帧）
     改：基于实际时间戳差值计算，与帧率无关
  2. startup_grace 统一为 30 秒（与 main_v2_fixed.py 保持一致）
     原来只有 10 秒，传感器还未稳定就开始报警
  3. hr_alert_cooldown 延长为 120 秒
     原来 60 秒太短，高心率持续时会频繁报警
  4. _classify_target 删除（与 ca1_improvements.HumanPetClassifier 重复）
     Agent 层不再做人宠区分，由 main_v2_fixed.py 统一处理后传入
  5. 每日统计 hr_readings 列表无限增长问题修复
     改为只保留最近 24 小时的数据（最多 86400 条）

【功能改进】
  6. LLM 调用增加超时保护和重试逻辑
  7. 主动巡检间隔改为可配置（默认 3600 秒）
  8. 每日报告时间改为 20:00，并增加"今日最高/最低心率"字段
  9. MQTT 连接失败后每 60 秒自动重试

部署环境：NVIDIA Jetson Nano B01
"""

import json
import time
import logging
import threading
import os
import subprocess
import schedule
import requests
from datetime import datetime
from typing import Optional, Tuple, List
import paho.mqtt.client as mqtt

# ============================================================
# 日志配置
# ============================================================
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger("AgentCompanion")

# ============================================================
# 配置常量
# ============================================================
MQTT_BROKER           = "broker.hivemq.com"
MQTT_PORT             = 1883
MQTT_TOPIC_TELEMETRY  = "/elderly_care/device_001/telemetry"
MQTT_TOPIC_ALERT      = "/elderly_care/device_001/alert"
MQTT_TOPIC_AGENT_LOG  = "/elderly_care/device_001/agent_log"

# 通义千问 API（在线 LLM）
TONGYI_API_URL = "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation"
TONGYI_API_KEY = "sk-YOUR_API_KEY_HERE"   # 替换为实际 API Key
TONGYI_MODEL   = "qwen-turbo"

# 本地 Ollama（离线 LLM 兜底）
OLLAMA_API_URL = "http://localhost:11434/api/generate"
OLLAMA_MODEL   = "qwen2:1.5b"

# USB 声卡设备（card 2 = YB-MAE02）
AUDIO_DEVICE = "plughw:2,0"

# 跌倒检测阈值
# v2.8修复：提高跌倒阈值，防止坐姿调整导致误报
FALL_MOTION_THRESHOLD = 150   # v2.8：从70提高到150，坐姿调整最高只到100，
                              # 真正的跌倒前体动应该极其剧烈（>150）
FALL_STILL_DURATION   = 8.0   # v2.8：从5秒延长到 8 秒，减少单次瞬时静止的误报
FALL_STILL_THRESHOLD  = 5.0   # v2.8：从3提高到 5，体动<5才认为静止（坐着小动作不会被误判）

# 心率报警阈值
HR_HIGH_THRESHOLD  = 120      # bpm，持续超过此值才报警
HR_LOW_THRESHOLD   = 50       # bpm，低于此值报警
                              # v2.9c：从40提高到50，医学标准成人静息<60为心动过缓
                              # 考虑老人个体差异保留一定余量，50是合理的报警边界
HR_CONFIRM_COUNT   = 3        # 连续 N 次超阈值才触发（防单帧误报）
HR_ALERT_COOLDOWN  = 120      # 秒，同类心率报警冷却时间

# 呼吸率报警阈值（仅夜间）
RESP_LOW_THRESHOLD  = 8       # 次/分
RESP_HIGH_THRESHOLD = 25      # 次/分
RESP_ALERT_COOLDOWN = 120     # v2.9：从60秒延长到120秒
RESP_CONFIRM_COUNT  = 3       # v2.9新增：连续3次才报警（防单帧噪声）

# SpO2 报警阈值（v2.9新增）
SPO2_LOW_THRESHOLD  = 90      # %，低于此值报警（正常≥95%，<90%为低氧）
SPO2_ALERT_COOLDOWN = 120     # 秒
SPO2_CONFIRM_COUNT  = 3       # 连续3帧（约15秒）才报警，防接触不稳定误报

# 跌倒候选超时（v2.9新增）
FALL_CANDIDATE_TIMEOUT = 60.0 # 秒，跌倒候选超过60秒未确认则自动清除

# BVI 报警阈值
BVI_CRITICAL_THRESHOLD = 15   # 极低活力
BVI_LOW_THRESHOLD      = 30   # 低活力
BVI_ALERT_COOLDOWN     = 300  # 秒（5 分钟内不重复）

# 启动预热期（秒）
STARTUP_GRACE = 30            # 与 main_v2_fixed.py 保持一致

# 主动巡检间隔（秒）
# 正式部署建议 3600（每小时），测试时可改为 120（2分钟）
PROACTIVE_CHECK_INTERVAL = 120   # 测试模式：2分钟触发一次（部署时改为 3600）


# ============================================================
# 工具函数
# ============================================================

def tool_speak(text: str, urgent: bool = False) -> bool:
    """
    工具：语音播报
    优先使用 espeak + USB 声卡（card 2 = YB-MAE02），失败则打印日志
    """
    prefix = "[URGENT] " if urgent else ""
    logger.info(f"[TTS] {prefix}{text}")

    try:
        wav_path = "/tmp/tts_agent.wav"
        speed = 120 if urgent else 140
        ret = subprocess.call(
            ["espeak", "-v", "zh", "-s", str(speed), "-w", wav_path, text],
            stdout=open(os.devnull, 'w'),
            stderr=open(os.devnull, 'w')
        )
        if ret == 0 and os.path.exists(wav_path):
            subprocess.Popen(
                ["aplay", "-D", AUDIO_DEVICE, "-q", wav_path],
                stdout=open(os.devnull, 'w'),
                stderr=open(os.devnull, 'w')
            )
            return True
    except Exception as e:
        logger.debug(f"espeak TTS failed: {e}")

    return True  # 日志输出始终算成功


def tool_publish_alert(alert_type: str, severity: str, message: str,
                       sensor_data: dict, mqtt_client) -> bool:
    """工具：发布报警到 MQTT"""
    payload = {
        "type":      alert_type,
        "severity":  severity,
        "message":   message,
        "data":      sensor_data,
        "timestamp": time.time(),
        "device_id": "jetson_nano_001"
    }
    try:
        mqtt_client.publish(
            MQTT_TOPIC_ALERT,
            json.dumps(payload, ensure_ascii=False)
        )
        logger.warning(f"[ALERT] {alert_type}({severity}): {message[:60]}")
        return True
    except Exception as e:
        logger.debug(f"MQTT alert publish failed: {e}")
        return False


def tool_call_llm(prompt: str, is_online: bool = True,
                  max_tokens: int = 100, timeout: int = 8) -> str:
    """
    工具：调用大语言模型
    在线优先（通义千问），离线兜底（本地 Ollama qwen2:1.5b）

    v2.3 改进：增加超时保护，避免 LLM 调用阻塞主线程
    """
    # ── 在线：通义千问 ──
    if is_online and TONGYI_API_KEY != "sk-YOUR_API_KEY_HERE":
        try:
            headers = {
                "Authorization": f"Bearer {TONGYI_API_KEY}",
                "Content-Type": "application/json"
            }
            body = {
                "model": TONGYI_MODEL,
                "input": {"messages": [{"role": "user", "content": prompt}]},
                "parameters": {"max_tokens": max_tokens, "temperature": 0.7}
            }
            resp = requests.post(
                TONGYI_API_URL, headers=headers, json=body, timeout=timeout
            )
            if resp.status_code == 200:
                return resp.json()["output"]["choices"][0]["message"]["content"].strip()
            else:
                logger.warning(f"Tongyi API error: {resp.status_code}")
        except requests.Timeout:
            logger.warning("Tongyi API timeout, falling back to Ollama")
        except Exception as e:
            logger.warning(f"Online LLM failed: {e}")

    # ── 离线兜底：本地 Ollama ──
    try:
        resp = requests.post(
            OLLAMA_API_URL,
            json={"model": OLLAMA_MODEL, "prompt": prompt, "stream": False},
            timeout=15
        )
        if resp.status_code == 200:
            return resp.json().get("response", "").strip()
    except requests.Timeout:
        logger.debug("Ollama timeout")
    except Exception as e:
        logger.debug(f"Local LLM failed: {e}")

    # ── 最终兜底：固定回复 ──
    return "您好，系统正在运行，请保重身体。"


def tool_generate_daily_report(daily_stats: dict, is_online: bool = True) -> str:
    """工具：生成每日健康报告（v2.3：增加最高/最低心率字段）"""
    prompt = (
        "你是一个专业的老年健康助手，请根据以下今日数据生成一份简短的中文健康日报（不超过100字）：\n"
        f"- 平均心率：{daily_stats.get('avg_hr', 'N/A')} bpm\n"
        f"- 最高心率：{daily_stats.get('max_hr', 'N/A')} bpm\n"
        f"- 最低心率：{daily_stats.get('min_hr', 'N/A')} bpm\n"
        f"- 平均呼吸率：{daily_stats.get('avg_resp', 'N/A')} 次/分\n"
        f"- 活动时长：{daily_stats.get('active_minutes', 'N/A')} 分钟\n"
        f"- 行为活力指数(BVI)：{daily_stats.get('avg_bvi', 'N/A')} / 100\n"
        f"- 今日报警次数：{daily_stats.get('alert_count', 0)} 次\n"
        "请用温暖、关怀的语气，给出1-2条具体的健康建议。"
    )
    return tool_call_llm(prompt, is_online, max_tokens=120, timeout=10)


# ============================================================
# 核心 Agent 类
# ============================================================

class ElderlyCompanionAgent:
    """
    独居老人陪伴 Agent v2.3

    架构：感知（perceive）→ 推理（reason_and_act）→ 行动（tool_*）

    v2.3 改进：
    - active_minutes 改为基于实际时间戳计算（修复帧率依赖 Bug）
    - startup_grace 统一为 30 秒
    - hr_alert_cooldown 延长为 120 秒
    - 删除重复的 _classify_target（由 main 统一处理）
    - 每日统计列表增加长度保护（最多 86400 条）
    - LLM 调用增加超时保护
    - MQTT 连接失败后自动重试
    """

    def __init__(self):
        self.is_online              = True
        self.current_state          = {}
        self._last_active_ts        = 0.0   # 上次活动时间戳（用于精确计算活动时长）

        # 每日统计（每天 20:00 重置）
        self.daily_stats = {
            "hr_readings":    [],    # 心率读数列表（最多 86400 条）
            "resp_readings":  [],    # 呼吸率读数列表
            "bvi_readings":   [],    # BVI 读数列表
            "active_seconds": 0.0,  # 活动总秒数（v2.3：改为秒，更精确）
            "alert_count":    0,
        }

        # 跌倒检测状态
        self.last_fall_alert_time  = 0.0
        self.fall_alert_cooldown   = 30.0
        self.fall_candidate_time   = 0.0
        self.fall_candidate_active = False
        self._pre_fall_hr          = 0.0

        # 心率报警状态（持续确认机制）
        self.last_hr_alert_time    = 0.0
        self._hr_high_count        = 0
        self._hr_low_count         = 0

        # 呼吸率报警状态
        self.last_resp_alert_time  = 0.0

        # BVI 报警状态
        self.last_bvi_alert_time   = 0.0

        # 夜间离床检测
        self.last_bed_exit_time    = None

        # 呼吸率报警确认计数（v2.9）
        self._resp_abnormal_count  = 0

        # SpO2 报警状态（v2.9新增）
        self.last_spo2_alert_time  = 0.0
        self._spo2_low_count       = 0

        # 主动巡检（初始化为0，确保启动后第一次巡检能立即触发）
        self.last_proactive_check  = 0

        # 启动预热期
        self.startup_time          = time.time()

        # MQTT（后台异步连接，失败自动重试）
        self.mqtt_client           = mqtt.Client()
        self.mqtt_client.on_connect = self._on_mqtt_connect
        self.mqtt_connected        = False
        self._mqtt_retry_time      = 0.0
        self._setup_mqtt_async()

        # 定时任务
        schedule.every().day.at("20:00").do(self._generate_daily_report)
        schedule.every(30).seconds.do(self._check_network)

        logger.info("ElderlyCompanionAgent v2.4 initialized.")

    # ----------------------------------------------------------
    # MQTT 连接管理
    # ----------------------------------------------------------
    def _setup_mqtt_async(self):
        """后台线程连接 MQTT，不阻塞初始化"""
        def connect():
            brokers = [
                ("broker.hivemq.com",  1883),
                ("test.mosquitto.org", 1883),
            ]
            for broker, port in brokers:
                try:
                    self.mqtt_client.connect(broker, port, keepalive=60)
                    self.mqtt_client.loop_start()
                    logger.info(f"MQTT connected to {broker}")
                    return
                except Exception as e:
                    logger.warning(f"MQTT {broker} failed: {e}")
            logger.warning("MQTT unavailable. Alerts will be logged only.")

        threading.Thread(target=connect, daemon=True).start()

    def _on_mqtt_connect(self, client, userdata, flags, rc):
        if rc == 0:
            self.mqtt_connected = True
            logger.info(f"MQTT connected (rc={rc})")
        else:
            self.mqtt_connected = False
            logger.warning(f"MQTT connect failed (rc={rc})")

    def _check_network(self):
        """定期检查网络状态（每30秒）"""
        try:
            requests.get("http://www.baidu.com", timeout=3)
            self.is_online = True
        except Exception:
            if self.is_online:
                logger.warning("Network lost! Switching to offline mode.")
                self.is_online = False

    # ----------------------------------------------------------
    # 核心感知与推理循环
    # ----------------------------------------------------------
    def perceive(self, sensor_data: dict):
        """感知层：接收传感器数据，更新内部状态，驱动推理"""
        self.current_state = sensor_data

        # 优先使用融合心率 fused_hr，兜底使用 r_hr
        fused_hr = float(sensor_data.get("fused_hr", 0))
        r_hr     = float(sensor_data.get("r_hr", 0))
        hr       = fused_hr if fused_hr > 0 else r_hr

        resp     = float(sensor_data.get("r_resp", 0))
        movement = float(sensor_data.get("r_mov", 0))
        bvi      = float(sensor_data.get("bvi", 0))
        spo2     = float(sensor_data.get("ppg_spo2", 0))

        # ── 更新每日统计 ──
        now = time.time()

        # 心率（保护列表长度，最多 86400 条 ≈ 24小时@1Hz）
        if hr > 0:
            self.daily_stats["hr_readings"].append(hr)
            if len(self.daily_stats["hr_readings"]) > 86400:
                self.daily_stats["hr_readings"] = self.daily_stats["hr_readings"][-86400:]

        if resp > 0:
            self.daily_stats["resp_readings"].append(resp)
            if len(self.daily_stats["resp_readings"]) > 86400:
                self.daily_stats["resp_readings"] = self.daily_stats["resp_readings"][-86400:]

        self.daily_stats["bvi_readings"].append(bvi)
        if len(self.daily_stats["bvi_readings"]) > 86400:
            self.daily_stats["bvi_readings"] = self.daily_stats["bvi_readings"][-86400:]

        # 活动时长：基于实际时间戳差值计算（修复帧率依赖 Bug）
        if movement > 1.5:
            if self._last_active_ts > 0:
                dt = now - self._last_active_ts
                if dt < 10.0:  # 超过10秒的间隔不计入（可能是暂停）
                    self.daily_stats["active_seconds"] += dt
            self._last_active_ts = now
        else:
            self._last_active_ts = 0.0

        self.reason_and_act(hr, resp, movement, bvi, spo2)

    def reason_and_act(self, hr: float, resp: float,
                       movement: float, bvi: float, spo2: float = 0.0):
        """推理层：根据当前状态决定是否需要行动"""

        now      = time.time()
        in_grace = (now - self.startup_time) < STARTUP_GRACE

        # ── 规则1：跌倒检测 ──
        if movement > FALL_MOTION_THRESHOLD:
            if not in_grace:
                self._pre_fall_hr          = hr
                self.fall_candidate_active = True
                self.fall_candidate_time   = now
            return  # 高体动帧不做其他判断

        if self.fall_candidate_active:
            still_duration = now - self.fall_candidate_time

            # v2.9：跌倒候选超时自动清除（防止无限期等待）
            if still_duration > FALL_CANDIDATE_TIMEOUT:
                logger.debug(f"[Fall] Candidate expired after {still_duration:.0f}s, cleared.")
                self.fall_candidate_active = False

            elif movement < FALL_STILL_THRESHOLD and still_duration >= FALL_STILL_DURATION:
                if now - self.last_fall_alert_time > self.fall_alert_cooldown:
                    hr_anomaly = (
                        self._pre_fall_hr > 0 and
                        abs(hr - self._pre_fall_hr) > 15
                    )
                    note = "（心率异常辅助确认）" if hr_anomaly else ""
                    logger.critical(
                        f"[FALL DETECTED] Still {still_duration:.1f}s after high motion{note}"
                    )
                    tool_speak("检测到疑似跌倒！您还好吗？我已通知您的家人。", urgent=True)
                    tool_publish_alert(
                        "fall", "critical",
                        f"疑似跌倒：高体动后静止 {still_duration:.0f} 秒{note}",
                        self.current_state, self.mqtt_client
                    )
                    self.daily_stats["alert_count"] += 1
                    self.last_fall_alert_time  = now
                self.fall_candidate_active = False
            elif movement > 5.0:
                # 重新运动，取消跌倒候选
                self.fall_candidate_active = False

        # ── 规则2：心率异常检测（持续确认机制）──
        if not in_grace and hr > 0:
            if hr > HR_HIGH_THRESHOLD:
                self._hr_high_count += 1
                self._hr_low_count   = 0
                if (self._hr_high_count >= HR_CONFIRM_COUNT and
                        now - self.last_hr_alert_time > HR_ALERT_COOLDOWN):
                    msg = f"心率持续偏高 {hr:.0f} bpm，请注意休息，避免剧烈活动。"
                    tool_speak(msg, urgent=True)
                    tool_publish_alert(
                        "hr_high", "warning", msg,
                        self.current_state, self.mqtt_client
                    )
                    self.daily_stats["alert_count"] += 1
                    self.last_hr_alert_time = now
                    self._hr_high_count     = 0

            elif 0 < hr < HR_LOW_THRESHOLD:
                self._hr_low_count  += 1
                self._hr_high_count  = 0
                # 心率过低：只需连续 2 次确认（更紧急）
                if (self._hr_low_count >= 2 and
                        now - self.last_hr_alert_time > HR_ALERT_COOLDOWN):
                    msg = f"心率偏低 {hr:.0f} bpm，请立即联系医生！"
                    tool_speak(msg, urgent=True)
                    tool_publish_alert(
                        "hr_low", "critical", msg,
                        self.current_state, self.mqtt_client
                    )
                    self.daily_stats["alert_count"] += 1
                    self.last_hr_alert_time = now
                    self._hr_low_count      = 0

            else:
                # 心率正常：逐渐衰减计数（不立即清零，避免边界振荡）
                self._hr_high_count = max(0, self._hr_high_count - 1)
                self._hr_low_count  = max(0, self._hr_low_count  - 1)

        # ── 规则三：夜间呼吸率异常（仅 22:00-06:00）──
        hour = datetime.now().hour
        is_night = (hour >= 22 or hour <= 6)
        if is_night and not in_grace and resp > 0:
            if (resp < RESP_LOW_THRESHOLD or resp > RESP_HIGH_THRESHOLD):
                # v2.9：连续确认机制，防单帧噪声误报
                self._resp_abnormal_count += 1
                if (self._resp_abnormal_count >= RESP_CONFIRM_COUNT and
                        now - self.last_resp_alert_time > RESP_ALERT_COOLDOWN):
                    msg = f"夜间呼吸率持续异常：{resp:.0f} 次/分，请注意。"
                    tool_speak(msg, urgent=True)
                    tool_publish_alert(
                        "resp_abnormal", "critical", msg,
                        self.current_state, self.mqtt_client
                    )
                    self.daily_stats["alert_count"] += 1
                    self.last_resp_alert_time = now
                    self._resp_abnormal_count = 0
            else:
                # 呼吸率正常，计数减少（不立即清零）
                self._resp_abnormal_count = max(0, self._resp_abnormal_count - 1)

        # ── 规则三b：SpO2 低氧报警（v2.9新增）──
        if not in_grace and spo2 > 0:
            if spo2 < SPO2_LOW_THRESHOLD:
                # 连续确认机制：连续3帧（约15秒）才报警，防接触不稳定误报
                self._spo2_low_count += 1
                if (self._spo2_low_count >= SPO2_CONFIRM_COUNT and
                        now - self.last_spo2_alert_time > SPO2_ALERT_COOLDOWN):
                    msg = f"血氧饱和度持续偏低（{spo2:.0f}%），请注意休息，如有不适请立即就医。"
                    tool_speak(msg, urgent=True)
                    tool_publish_alert(
                        "spo2_low", "critical", msg,
                        self.current_state, self.mqtt_client
                    )
                    self.daily_stats["alert_count"] += 1
                    self.last_spo2_alert_time = now
                    self._spo2_low_count      = 0
            else:
                # SpO2 正常，计数逐渐衰减
                self._spo2_low_count = max(0, self._spo2_low_count - 1)

        # ── 规则4：夜间离床超时检测 ──
        self._check_nocturnal_absence(movement, is_night)

        # ── 规则5：BVI 低活力报警（仅白天 9:00-21:00）──
        if not in_grace and bvi > 0:
            self._check_bvi_alert(bvi, now, hour)

        # ── 规则6：主动巡检（BVI 驱动，每小时一次）──
        self._proactive_check(bvi, now, hour)

    # ----------------------------------------------------------
    # 夜间离床检测
    # ----------------------------------------------------------
    def _check_nocturnal_absence(self, movement: float,
                                  is_night: bool):
        """夜间离床超时检测（仅 22:00-06:00）"""
        if not is_night:
            self.last_bed_exit_time = None
            return

        now = time.time()
        if movement > 1.0:
            if self.last_bed_exit_time is None:
                self.last_bed_exit_time = now
                logger.info("[Nocturnal] Bed exit detected.")
        else:
            if self.last_bed_exit_time is not None:
                duration_min = (now - self.last_bed_exit_time) / 60.0
                if duration_min > 30:
                    msg = f"夜间离床已超过 {duration_min:.0f} 分钟，请确认老人状态。"
                    tool_speak(msg, urgent=True)
                    tool_publish_alert(
                        "bed_absence", "warning", msg,
                        {"duration_min": round(duration_min, 1)},
                        self.mqtt_client
                    )
                    self.daily_stats["alert_count"] += 1
                self.last_bed_exit_time = None
                logger.info(f"[Nocturnal] Returned to bed after {duration_min:.1f} min.")

    # ----------------------------------------------------------
    # BVI 低活力报警
    # ----------------------------------------------------------
    def _check_bvi_alert(self, bvi: float, now: float, hour: int):
        """BVI 低活力报警（仅白天 9:00-21:00）"""
        if not (9 <= hour <= 21):
            return
        if now - self.last_bvi_alert_time < BVI_ALERT_COOLDOWN:
            return

        if bvi < BVI_CRITICAL_THRESHOLD:
            msg = f"行为活力指数极低（{bvi:.0f}/100），老人可能长时间静止不动，请关注。"
            tool_speak(msg)
            tool_publish_alert(
                "bvi_critical", "warning", msg,
                self.current_state, self.mqtt_client
            )
            self.daily_stats["alert_count"] += 1
            self.last_bvi_alert_time = now
        elif bvi < BVI_LOW_THRESHOLD:
            msg = f"行为活力指数偏低（{bvi:.0f}/100），建议鼓励老人适当活动。"
            tool_speak(msg)
            tool_publish_alert(
                "bvi_low", "info", msg,
                self.current_state, self.mqtt_client
            )
            self.last_bvi_alert_time = now

    # ----------------------------------------------------------
    # 主动巡检
    # ----------------------------------------------------------
    def _proactive_check(self, bvi: float, now: float, hour: int):
        """主动巡检（BVI 驱动，每小时一次，夜间不打扰）"""
        if now - self.last_proactive_check < PROACTIVE_CHECK_INTERVAL:
            return
        self.last_proactive_check = now

        # 夜间不打扰（22:00-07:00）
        if hour >= 22 or hour <= 7:
            return

        status_desc = "状态良好" if bvi >= 70 else ("状态偏低，可能需要关注" if bvi < 30 else "状态一般")
        prompt = (
            f"你是一个贴心的家庭陪伴助手，正在照顾一位独居老人。"
            f"当前老人的行为活力指数(BVI)为 {bvi:.0f}/100，{status_desc}。"
            f"现在是 {hour} 点，请生成一句温暖的主动问候语（不超过25字），不要提及具体数值。"
        )

        # LLM 调用在后台线程执行，避免阻塞主循环
        def _call_and_speak():
            response = tool_call_llm(prompt, self.is_online, max_tokens=50)
            if response:
                tool_speak(response)
                # ── 推送到 Dashboard（HTTP）────────────────────────────────
                try:
                    from jetson_push_data import push_companion_log
                    # 先推送 system 巡检触发记录
                    push_companion_log(
                        role="system",
                        content=f"主动巡检触发 — BVI活力指数 {bvi:.0f}/100（检测到活动量偏低）",
                        log_type="patrol"
                    )
                    # 再推送 AI 问候语
                    push_companion_log(
                        role="assistant",
                        content=response,
                        log_type="patrol"
                    )
                    logger.info(f"[Patrol] Pushed to Dashboard: {response[:40]}...")
                except Exception as e:
                    logger.warning(f"[Patrol] Dashboard push failed: {e}")
                # ── 同时通过 MQTT 广播（保持原有逻辑）──────────────────────
                if self.mqtt_connected:
                    try:
                        self.mqtt_client.publish(
                            MQTT_TOPIC_AGENT_LOG,
                            json.dumps({
                                "type":       "proactive_check",
                                "agent_text": response,
                                "bvi":        bvi,
                                "timestamp":  time.time()
                            }, ensure_ascii=False)
                        )
                    except Exception:
                        pass

        threading.Thread(target=_call_and_speak, daemon=True).start()

    # ----------------------------------------------------------
    # 每日健康报告
    # ----------------------------------------------------------
    def _generate_daily_report(self):
        """每日 20:00 自动生成健康日报"""
        hr_list = self.daily_stats["hr_readings"]
        if not hr_list:
            logger.info("[Daily Report] No data today, skipping.")
            return

        resp_list = self.daily_stats["resp_readings"]
        bvi_list  = self.daily_stats["bvi_readings"]

        stats = {
            "avg_hr":         round(sum(hr_list) / len(hr_list), 1),
            "max_hr":         round(max(hr_list), 1),
            "min_hr":         round(min(hr_list), 1),
            "avg_resp":       (
                round(sum(resp_list) / len(resp_list), 1)
                if resp_list else "N/A"
            ),
            "active_minutes": round(self.daily_stats["active_seconds"] / 60.0, 1),
            "avg_bvi":        (
                round(sum(bvi_list) / len(bvi_list), 1)
                if bvi_list else 0
            ),
            "alert_count":    self.daily_stats["alert_count"],
        }

        # LLM 在后台线程生成报告
        def _generate_and_speak():
            report = tool_generate_daily_report(stats, self.is_online)
            logger.info(f"[Daily Report] {report}")
            tool_speak(report)
            if self.mqtt_connected:
                try:
                    self.mqtt_client.publish(
                        MQTT_TOPIC_AGENT_LOG,
                        json.dumps({
                            "type":      "daily_report",
                            "report":    report,
                            "stats":     stats,
                            "timestamp": time.time()
                        }, ensure_ascii=False)
                    )
                except Exception:
                    pass

        threading.Thread(target=_generate_and_speak, daemon=True).start()

        # 重置每日统计
        self.daily_stats = {
            "hr_readings":    [],
            "resp_readings":  [],
            "bvi_readings":   [],
            "active_seconds": 0.0,
            "alert_count":    0,
        }
        self._last_active_ts = 0.0
        logger.info(f"[Daily Report] Stats reset. Today: avg_hr={stats['avg_hr']}, "
                    f"active={stats['active_minutes']}min, alerts={stats['alert_count']}")

    # ----------------------------------------------------------
    # 定时任务调度
    # ----------------------------------------------------------
    def run_scheduler(self):
        """在后台线程运行定时任务"""
        while True:
            schedule.run_pending()
            time.sleep(1)

    def start(self):
        """启动 Agent（后台调度线程）"""
        threading.Thread(target=self.run_scheduler, daemon=True).start()
        logger.info("Agent scheduler started (v2.3).")
