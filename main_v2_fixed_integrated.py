#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
独居老人陪伴系统 - Jetson Nano 主控程序 v2.9（最终稳定版）
Main Controller v2.9 - Final Stable Edition

版本历史：
  v2.0  基础版，固定权重融合
  v2.3  引入 Q 值阈值融合（后发现 Q 值天然偏低，无效）
  v2.5  改用 PPG-雷达一致性融合（差值15/30分档）
  v2.6  四规则语义融合框架（项目最终确认方案）+ 全面 Bug 修复
  v2.7  精准修复 PPG 150bpm 锁定 + 雷达瞬时归零误切换问题（2026-03-25）
  v2.8  修复跌倒误报（阈值70→150）+ RULE1阈值优化（120→100）（2026-03-25）
  v2.9  PPG 离手检测机制：实时幅度监测+缓冲区清空，防止历史数据惯性（2026-03-25）
  v2.9b 状态惰性机制：连续3次计算失败才切换NO-SIGNAL，防止偶发CV抖动导致频繁跳变（2026-03-25）
  v2.9c 阈值最终优化：HR_MAX_CHANGE 15→20，HR_NORMAL_MAX 保持100，BVI活动归一化/10（2026-03-25）
  v2.9d 彻底修复NO-SIGNAL根本原因：幅度小不阻断计算+状态显示用_consec_fail判断（2026-03-25）

v2.7 精准修复（2026-03-25）：
═══════════════════════════════════════════════════════════════
【问题1：PPG 心率持续爬升到 150bpm 并锁定】
  根本原因：MIN_PEAK_DIST=20 对应最大心率 150bpm，噪声峰值恰好
  落在间距=20处，导致算法计算出 150bpm 并锁定。
  修复：MIN_PEAK_DIST 提高到 25（对应 120bpm），老人心率>120
  即为异常，不需要 PPG 测量此范围；同时增加变化速率限制
  （相邻帧差值>15bpm 视为噪声，保持上次值）。

【问题2：雷达心率瞬时归零导致误切换 PPG-ONLY】
  根本原因：R60ABD1 在目标体动较大时 hr_r 会短暂输出 0（硬件
  正常行为），但融合算法立即切换 PPG-ONLY，此时 PPG 噪声被全权采信。
  修复：增加"上次有效雷达心率保持"逻辑，连续 3 帧归零才真正
  切换 PPG-ONLY，单帧归零使用上次有效值替代。

【最终融合策略：四规则语义框架】
  优先级从高到低依次判断：
  ┌────────────────────────────────────┬──────────────────────────┐
  │ 情况                               │ 处理方式                  │
  ├────────────────────────────────────┼──────────────────────────┤
  │ 雷达高(>120) + PPG正常(40-120)     │ 信任PPG（体动干扰雷达）   │
  │ PPG突变(与上次差>30) + 雷达正常    │ 信任雷达，忽略PPG         │
  │ 两者都异常(差>40且都超出40-120)    │ 保持上次融合值不变        │
  │ 差值 ≤ 40bpm（默认情况）           │ 两者都可信，加权融合       │
  └────────────────────────────────────┴──────────────────────────┘
  规则4内部权重由体动（Motion）动态决定：
    motion > 30 → 雷达35% + PPG65%（体动干扰雷达，PPG更可靠）
    motion > 10 → 雷达45% + PPG55%
    motion ≤ 10 → 雷达55% + PPG45%（静止时雷达略优）
  + 5帧滑动窗口平滑，消除单帧突变

【Bug 修复列表】
  1. person_present 判断改用 r_exist==1 为主，避免噪声心率误判
  2. 模拟模式 PPG 幅度修正为真实硬件水平（~150 ADC units）
  3. 版本号注释统一为 v2.6
  4. 启动预热期统一为 30 秒（main 和 agent 保持一致）

部署环境：NVIDIA Jetson Nano B01
运行方式：python3 main_v2_fixed.py
"""
import json
import time
import logging
import threading
import signal
import sys
import os
import requests
import serial
import paho.mqtt.client as mqtt
from datetime import datetime
from typing import Optional
from collections import deque

# 导入 CA1 改进模块
from ca1_improvements import (
    RadarTarget,
    HumanPetClassifier,
    BehavioralVitalityIndex,
    NocturnalAnomalyDetector,
)
from agent_companion_fixed import ElderlyCompanionAgent

# ─── Dashboard 推送模块 ───────────────────────────────────────────────────────
# 将 jetson_push_data.py 放在与本文件相同目录下即可
try:
    from jetson_push_data import push_vitals, push_alert, push_companion_log
    DASHBOARD_PUSH_AVAILABLE = True
except ImportError:
    DASHBOARD_PUSH_AVAILABLE = False
    def push_vitals(data): pass          # 占位函数，不影响主程序运行
    def push_alert(t, s, m, mz=''): pass
    def push_companion_log(r, c, lt='chat'): pass
    import logging as _log
    _log.getLogger('MainController').warning(
        'jetson_push_data.py not found — Dashboard push disabled. '
        'Place jetson_push_data.py in the same directory.'
    )

# 导入语音对话模块（可选）
try:
    from voice_conversation import VoiceConversationManager, create_mqtt_voice_handler
    VOICE_MODULE_AVAILABLE = True
except ImportError as _ve:
    VOICE_MODULE_AVAILABLE = False
    _voice_import_error = str(_ve)

# ============================================================
# 日志配置
# ============================================================
LOG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "companion_system.log")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(LOG_PATH, encoding="utf-8"),
    ],
)
logger = logging.getLogger("MainController")

# ============================================================
# 硬件配置
# ============================================================
STM32_PORT = "/dev/ttyUSB0"
STM32_BAUD = 115200
MQTT_BROKER           = "broker.hivemq.com"
MQTT_PORT             = 1883
MQTT_TOPIC_TELEMETRY  = "/elderly_care/device_001/telemetry"
MQTT_TOPIC_ALERT      = "/elderly_care/device_001/alert"
MQTT_TOPIC_AGENT_LOG  = "/elderly_care/device_001/agent_log"
MQTT_TOPIC_COMMAND    = "/elderly_care/device_001/command"


# ============================================================
# PPG 心率计算器 v2.6
# ============================================================
class PPGHeartRateCalculator:
    """
    从 PPG ADC 原始值计算心率 v2.6

    硬件：DFRobot SEN0203（单通道反射式 PPG）
    STM32 采样率：约 50Hz（每帧 20ms）
    窗口大小：300 个点 = 6 秒

    v2.6 改进：
    - contact_quality 重新定义为"传感器接触状态"指示
      （0=未接触, 5=预热中, 15=轻微接触, 40=良好, 75=优秀）
      不再参与融合决策，仅用于 Dashboard 显示
    - 模拟模式 PPG 幅度修正为真实硬件水平（~150 ADC units）
    - 自适应阈值峰值检测（第65百分位数）
    - 峰值间距一致性检验（CV < 0.35）
    - 心率结果有效性范围 35-180 bpm
    """
    SAMPLE_RATE      = 50    # Hz
    WINDOW_SIZE      = 200   # 4 秒窗口（v2.9修复：从300减小到200，减少窗口内心跳周期数，降低CV）
    MIN_PEAK_DIST    = 25    # 最小峰値间距（对应最大心率 120bpm @ 50Hz）
    MAX_PEAK_DIST    = 100   # 最大峰値间距（对应最小心率 30bpm @ 50Hz）
    SMOOTHING_WINDOW = 7     # 移动平均窗口
    HR_MAX_CHANGE    = 20    # 单次心率变化速率限制（bpm/帧）
                             # v2.9c：从15提高到20，防止正常运动后心率变化被误判为噪声
                             # 实测PPG帧间波动可达15~20bpm，15过于保守
    MIN_BUFFER_SIZE  = 100   # 最小缓冲区大小（v2.9：从150减小到100，加快预热）值

    # ── v2.9 最终方案：完全放弃离手检测，改用“PPG心率有效性”判断 ──
    #
    # 「根本结论」：经过对您真实数据的深度分析，发现：
    #   - 佩戴时 std 从 29 慢慢爬升到 55，完全覆盖了离手时的 std（约40）
    #   - 没有任何单一特征（std/幅度/集中度）能可靠区分“佩戴”和“离手”
    #
    # 「正确思路」：不要检测“是否离手”，而是检测“PPG心率计算是否有效”
    #   - 如果 PPG 能计算出心率（节律稳定、CV<0.35），就是佩戴且信号有效
    #   - 如果 PPG 计算不出心率（节律混乱），就是离手或信号无效
    #   - 两种情况对融合算法的处理方式完全相同：均使用雷达为主导
    #
    # 「关键改变」：删除所有离手检测代码，删除缓冲区清空操作
    #   - WARMING-UP 状态只在数据不足时出现（少于150帧）
    #   - 不再有 NO-CONTACT 状态（删除这个状态）
    #   - PPG心率计算失败时，返回 0.0，融合层自动切换到 RADAR-ONLY
    #   - 缓冲区永远不清空，数据持续累积，就算手指轻触也能尽快计算出心率

    # ── v2.9 最终方案新增：状态惰性机制 ──
    # 连续失败 MAX_FAIL_BEFORE_NOSIGNAL 次才切换到 NO-SIGNAL
    # 防止因 PPG 计算器偶发性失败（CV 抖动）导致状态频繁跳变
    MAX_FAIL_BEFORE_NOSIGNAL = 3   # 连续3次失败（约15秒）才切换

    def __init__(self):
        self.raw_buffer         = deque(maxlen=self.WINDOW_SIZE)
        self.timestamps         = deque(maxlen=self.WINDOW_SIZE)
        self.last_hr            = 0.0
        self.last_quality       = 0
        self.last_spo2          = 98.0
        self._no_hr_count       = 0      # 连续计算不出心率的帧数
        self._has_valid_hr      = False  # 是否曾经有过有效心率
        self._consec_fail       = 0      # 连续失败帧计数（状态惰性用）

    def update(self, ppg_raw: int, ts_ms: int) -> tuple:
        """
        更新 PPG 数据，返回 (hr, spo2, contact_quality)

        contact_quality 含义（v2.6）：
          0      = 传感器未接触（ADC 饱和或为0）
          5      = 预热中（数据不足）
          15     = 轻微接触（SEN0203 正常现象，幅度 < 80）
          40     = 良好接触（幅度 80-200）
          75     = 优秀接触（幅度 > 200）
        """
        # 过滤确实无效的帧（ADC 饱和或为0）
        if ppg_raw <= 10 or ppg_raw >= 4085:
            return 0.0, self.last_spo2, 0

        self.raw_buffer.append(ppg_raw)
        self.timestamps.append(ts_ms)

        # 需要足够多的数据点（v2.9：减小到100帧=2秒，加快预热）
        if len(self.raw_buffer) < self.MIN_BUFFER_SIZE:
            return self.last_hr, self.last_spo2, 5  # 预热中

        buf = list(self.raw_buffer)
        n   = len(buf)

        sig_max   = max(buf)
        sig_min   = min(buf)
        amplitude = sig_max - sig_min

        # 接触状态评估（仅反映物理接触质量，不参与融合）
        # v2.9d 修复：删除幅度过小时提前返回的逻辑，SEN0203信号幅度可能小但仍有效
        # 幅度小不代表心率计不出，应让峰値检测和CV验证自行决定
        if amplitude < 30:
            contact_quality = 5    # 低幅度，仅作显示用，不阻断计算
        elif amplitude < 80:
            contact_quality = 15
        elif amplitude < 200:
            contact_quality = 40
        else:
            contact_quality = 75

        # 移动平均滤波（去除高频噪声）
        hw = self.SMOOTHING_WINDOW // 2
        smoothed = []
        for i in range(n):
            lo = max(0, i - hw)
            hi = min(n, i + hw + 1)
            smoothed.append(sum(buf[lo:hi]) / (hi - lo))

        # 自适应阈值峰值检测（第65百分位数作为阈值）
        sorted_buf = sorted(smoothed)
        threshold  = sorted_buf[int(n * 0.65)]

        peaks = []
        for i in range(1, n - 1):
            if (smoothed[i] > threshold and
                    smoothed[i] > smoothed[i - 1] and
                    smoothed[i] > smoothed[i + 1]):
                if not peaks or (i - peaks[-1]) >= self.MIN_PEAK_DIST:
                    peaks.append(i)

        if len(peaks) < 3:
            # 峰値不足：PPG 心率无效
            self._no_hr_count += 1
            self._consec_fail += 1
            # 状态惰性：连续失败不超过阈值时，保持上次有效心率
            if self._consec_fail <= self.MAX_FAIL_BEFORE_NOSIGNAL and self.last_hr > 0:
                return self.last_hr, self.last_spo2, contact_quality
            return 0.0, self.last_spo2, contact_quality

        # 峰値间距一致性检验
        intervals = [peaks[i + 1] - peaks[i] for i in range(len(peaks) - 1)]
        valid_ivs = [iv for iv in intervals
                     if self.MIN_PEAK_DIST <= iv <= self.MAX_PEAK_DIST]
        if len(valid_ivs) < 2:
            self._no_hr_count += 1
            self._consec_fail += 1
            if self._consec_fail <= self.MAX_FAIL_BEFORE_NOSIGNAL and self.last_hr > 0:
                return self.last_hr, self.last_spo2, contact_quality
            return 0.0, self.last_spo2, contact_quality

        avg_iv = sum(valid_ivs) / len(valid_ivs)
        std_iv = (sum((iv - avg_iv) ** 2 for iv in valid_ivs) / len(valid_ivs)) ** 0.5
        cv     = std_iv / max(avg_iv, 1)

        # 双向CV阈值检测（根据真实硬件数据校准）：
        # 离手时：环境光噪声产生"假心跳"，间距极度规律，CV约=0.00
        # 佩戴时：真实心跳有自然心率变异性，CV在0.16~0.60之间
        if cv < 0.05:
            # CV过低：信号太规律，是离手时的假信号
            self._no_hr_count += 1
            self._consec_fail += 1
            if self._consec_fail <= self.MAX_FAIL_BEFORE_NOSIGNAL and self.last_hr > 0:
                return self.last_hr, self.last_spo2, contact_quality
            return 0.0, self.last_spo2, contact_quality

        if cv > 0.65:
            # CV过高：节律不稳定，PPG心率无效
            self._no_hr_count += 1
            self._consec_fail += 1
            if self._consec_fail <= self.MAX_FAIL_BEFORE_NOSIGNAL and self.last_hr > 0:
                return self.last_hr, self.last_spo2, contact_quality
            return 0.0, self.last_spo2, contact_quality

        # 计算心率
        hr = 60.0 * self.SAMPLE_RATE / avg_iv
        # 有效范围 40-120bpm，变化速率限制
        if 40 <= hr <= 120:
            if self.last_hr > 0 and abs(hr - self.last_hr) > self.HR_MAX_CHANGE:
                pass  # 变化过快，视为噪声，保持上次値
            else:
                self.last_hr = round(hr, 1)
                self._no_hr_count  = 0
                self._consec_fail  = 0   # 计算成功，重置连续失败计数
                self._has_valid_hr = True

        # SpO2 粗略估算（单通道，仅供参考）
        baseline      = sig_min + amplitude * 0.2
        ratio         = amplitude / max(baseline, 1)
        spo2_estimate = max(85.0, min(100.0, 110.0 - 25.0 * ratio))
        self.last_spo2    = round(spo2_estimate, 1)
        self.last_quality = contact_quality

        # 心率计算成功，返回有效心率
        if self.last_hr > 0:
            return self.last_hr, self.last_spo2, contact_quality
        else:
            return 0.0, self.last_spo2, contact_quality

    def get_last_values(self) -> tuple:
        return self.last_hr, self.last_spo2, self.last_quality


# ============================================================
# STM32 JSON 字段映射
# ============================================================
def normalize_frame(raw: dict, ppg_calculator: PPGHeartRateCalculator) -> dict:
    """
    将 STM32 输出的 JSON 字段名映射为系统内部字段名，并计算 PPG 心率

    STM32 输出格式：
    {"ts":310700,"ppg":4095,"hr_r":78,"br_r":14,"motion":8,
     "exist":1,"sleep":0,"score":0,"br_info":1}
    """
    ppg_raw = int(raw.get("ppg", 0))
    ts_ms   = int(raw.get("ts", int(time.time() * 1000)))
    ppg_hr, ppg_spo2, ppg_quality = ppg_calculator.update(ppg_raw, ts_ms)

    return {
        "ts":            raw.get("ts", 0),
        "r_hr":          float(raw.get("hr_r", 0)),
        "r_resp":        float(raw.get("br_r", 0)),
        "r_mov":         float(raw.get("motion", 0)),
        "r_sleep":       int(raw.get("sleep", 0)),
        "r_exist":       int(raw.get("exist", 0)),
        "r_score":       int(raw.get("score", 0)),
        "br_info":       int(raw.get("br_info", 0)),
        "ppg_raw":       ppg_raw,
        "ppg_hr":        ppg_hr,
        "ppg_spo2":      ppg_spo2,
        "ppg_quality":   ppg_quality,   # v2.6: 接触状态指示，非融合权重
        "rcs_energy":    0.8,
        "target_height": 165,
    }


# ============================================================
# TTS 管理器
# ============================================================
class AdaptiveTTSManager:
    """
    自适应 TTS 管理器
    优先使用 espeak + USB 声卡，不可用时退化为日志输出
    """
    def __init__(self):
        self.is_online         = self._check_network()
        self._espeak_available = self._check_espeak()
        self.mode = "espeak" if self._espeak_available else "print"
        logger.info(f"TTS initialized. Online={self.is_online}, mode={self.mode}")

    def _check_network(self) -> bool:
        try:
            requests.get("http://www.baidu.com", timeout=3)
            return True
        except Exception:
            return False

    def _check_espeak(self) -> bool:
        return os.system("which espeak > /dev/null 2>&1") == 0

    def speak(self, text: str, urgent: bool = False):
        prefix = "[URGENT] " if urgent else ""
        logger.info(f"[TTS] {prefix}{text}")
        if self._espeak_available:
            speed = 120 if urgent else 150
            os.system(f'espeak -v zh -s {speed} "{text}" &')


# ============================================================
# 主控制器
# ============================================================
class CompanionSystemController:
    """
    独居老人陪伴系统主控制器 v2.6

    职责：
    1. 从 STM32 串口读取传感器数据（雷达 + PPG）
    2. 对 PPG 原始 ADC 值进行心率计算
    3. 使用四规则语义框架融合雷达心率和 PPG 心率
    4. 调用 CA1 改进模块（人宠区分、BVI、夜间检测）
    5. 驱动 Agent 进行智能决策和报警
    6. 通过 MQTT 发布遥测数据到 Dashboard
    """

    # ── 四规则融合阈值（v2.8）──
    FUSION_DIFF_MAX  = 40    # 差值 ≤ 40bpm：两者都可信，加权融合
    HR_NORMAL_MIN    = 40    # 正常心率下界（bpm）
    HR_NORMAL_MAX    = 100   # v2.8修复：从120降低到100
                             # 老人静息心率很少超过100bpm，雷达在100-120时
                             # 也很可能是体动干扰，此时PPG更准确
    PPG_SPIKE_THRESH = 30    # PPG突变检测阈值（与上次差>30bpm）

    # ── 滑动窗口平滑 ──
    HR_SMOOTH_WINDOW = 5     # 5帧 ≈ 10秒

    # ── 启动预热期（秒）──
    STARTUP_GRACE    = 30    # 前30秒不触发报警，等待传感器稳定

    def __init__(self):
        self.running                = True
        self.mqtt_connected         = False
        self.frame_count            = 0
        self.last_telemetry_time    = 0
        self.telemetry_interval     = 5       # 每5秒发布一次遥测
        self._latest_enriched_frame = {}
        self._startup_time          = time.time()

        # 融合心率状态
        self._fused_hr_window     = deque(maxlen=self.HR_SMOOTH_WINDOW)
        self._last_fused_hr       = 0.0
        self._prev_ppg_hr         = 0.0   # 上一帧PPG心率（用于突变检测）
        self._last_valid_radar_hr = 0.0   # v2.7修复：上次有效雷达心率（防止瞬时归零切换PPG-ONLY）
        self._radar_zero_count    = 0     # v2.7修复：雷达连续归零帧数计数器

        # 子模块初始化
        self.ppg_calculator     = PPGHeartRateCalculator()
        self.classifier         = HumanPetClassifier()
        self.bvi_calc           = BehavioralVitalityIndex()
        self.nocturnal_detector = NocturnalAnomalyDetector()
        self.tts                = AdaptiveTTSManager()
        self.agent              = ElderlyCompanionAgent()

        # 语音模块（可选）
        self.voice_manager = None
        if VOICE_MODULE_AVAILABLE:
            try:
                self.voice_manager = VoiceConversationManager()
                logger.info("Voice module loaded successfully")
            except Exception as e:
                logger.warning(f"Voice module init failed: {e}")

        # MQTT 初始化
        self.mqtt_client = mqtt.Client()
        self.mqtt_client.on_connect = self._on_mqtt_connect
        self.mqtt_client.on_message = self._on_mqtt_message
        self._connect_mqtt()

        # 信号处理
        signal.signal(signal.SIGINT,  self._shutdown)
        signal.signal(signal.SIGTERM, self._shutdown)

        logger.info("CompanionSystemController v2.9 initialized.")

    # ----------------------------------------------------------
    # MQTT 连接管理
    # ----------------------------------------------------------
    def _connect_mqtt(self):
        try:
            self.mqtt_client.connect_async(MQTT_BROKER, MQTT_PORT, keepalive=60)
            self.mqtt_client.loop_start()
        except Exception as e:
            logger.error(f"MQTT connect failed: {e}")

    def _on_mqtt_connect(self, client, userdata, flags, rc):
        if rc == 0:
            self.mqtt_connected = True
            client.subscribe(MQTT_TOPIC_COMMAND)
            logger.info(f"MQTT connected to {MQTT_BROKER} (rc={rc})")
            # 注册语音 MQTT 处理器
            if self.voice_manager and VOICE_MODULE_AVAILABLE:
                handler = create_mqtt_voice_handler(
                    self.voice_manager, client, MQTT_TOPIC_AGENT_LOG
                )
                client.message_callback_add(MQTT_TOPIC_COMMAND, handler)
                logger.info("Voice MQTT handler registered.")
        else:
            logger.warning(f"MQTT connect failed rc={rc}")

    def _on_mqtt_message(self, client, userdata, msg):
        try:
            payload = json.loads(msg.payload.decode())
            logger.debug(f"MQTT command received: {payload}")
        except Exception as e:
            logger.debug(f"MQTT message parse error: {e}")

    # ----------------------------------------------------------
    # 核心帧处理
    # ----------------------------------------------------------
    def process_sensor_frame(self, frame: dict):
        """
        处理一帧传感器数据的完整流程：
        解析 → 存在性判断 → 心率融合 → 人宠区分 → BVI → 夜间检测 → Agent → 遥测
        """
        try:
            r_hr          = frame.get("r_hr", 0.0)
            r_resp        = frame.get("r_resp", 0.0)
            r_mov         = frame.get("r_mov", 0.0)
            r_exist       = frame.get("r_exist", 0)
            rcs_energy    = frame.get("rcs_energy", 0.8)
            target_height = frame.get("target_height", 165)
            ppg_hr        = frame.get("ppg_hr", 0.0)
            ppg_spo2      = frame.get("ppg_spo2", 98.0)
            ppg_quality   = frame.get("ppg_quality", 0)

            # 存在性判断：以雷达 exist 标志为主，心率非零为辅
            # r_exist==1 是雷达模块明确输出的"有人"标志，比 r_hr>0 更可靠
            person_present = (r_exist == 1) or (r_hr > 10)
            if not person_present:
                return

            # ── 心率融合（四规则语义框架 v2.6）──
            fused_hr, rule_label = self._fuse_heart_rate(r_hr, ppg_hr, r_mov)

            # ── CA1：人宠区分 ──
            radar_target = RadarTarget(
                rcs_energy=rcs_energy,
                target_height=target_height,
                movement_speed=r_mov
            )
            suppress, classify_reason = self.classifier.should_suppress_alarm(radar_target)
            if suppress:
                logger.debug(f"[PetFilter] {classify_reason}")
                self.bvi_calc.update(0, 0)
                return

            # ── BVI 计算 ──
            bvi = self.bvi_calc.update(fused_hr, r_mov)

            # ── 夜间异常检测 ──
            nocturnal_events = self.nocturnal_detector.update(r_resp, r_mov)
            for event in nocturnal_events:
                speak_text, alert_type = self.nocturnal_detector.get_event_message(event)
                urgent = (alert_type == "motionless_critical")
                self.tts.speak(speak_text, urgent=urgent)
                self._publish_alert(alert_type,
                                    "critical" if urgent else "warning",
                                    speak_text, frame)

            # ── 构建富化帧 ──
            enriched_frame = {
                **frame,
                "fused_hr":    fused_hr,
                "fusion_rule": rule_label,
                "bvi":         bvi,
                "bvi_trend":   self.bvi_calc.get_trend(),
                "is_human":    True,
                "tts_mode":    self.tts.mode,
            }
            self._latest_enriched_frame = enriched_frame

            # ── Agent 感知 ──
            self.agent.perceive(enriched_frame)

            # ── 语音模块上下文更新 ──
            if self.voice_manager:
                self.voice_manager.update_sensor_context(enriched_frame)

            # ── 定期遥测发布（每5秒）──
            self.frame_count += 1
            now = time.time()
            if now - self.last_telemetry_time >= self.telemetry_interval:
                # v2.9 最终版：不再有 NO-CONTACT 状态
                # PPG 状态只反映“心率是否有效”，不尝试判断是否离手
                # v2.9d 修复：状态显示使用 ppg_calculator.last_hr，而非当前帧的 ppg_hr
                # 原因：状态惰性机制返回 last_hr 时， ppg_hr 已正确为 last_hr
                # 但当 ppg_hr=0（真正失败）时，也需要检查 _consec_fail 才能准确判断状态
                _calc = self.ppg_calculator
                if len(_calc.raw_buffer) < _calc.MIN_BUFFER_SIZE:
                    contact_label = "WARMING-UP"
                elif _calc.last_hr > 0 and _calc._consec_fail <= _calc.MAX_FAIL_BEFORE_NOSIGNAL:
                    contact_label = "ACTIVE"   # 有效心率（包括惰性保持期）
                elif _calc.last_hr > 0 and ppg_hr > 0:
                    contact_label = "ACTIVE"
                else:
                    contact_label = "NO-SIGNAL" # 连续失败超过阈值，真正无信号
                logger.info(
                    f"[STATUS] HR:{fused_hr:.0f}bpm"
                    f"(R:{r_hr:.0f}+PPG:{ppg_hr:.0f}|{rule_label})"
                    f" BR:{r_resp:.0f}/min Mot:{r_mov:.0f}"
                    f" BVI:{bvi:.1f} SpO2:{ppg_spo2:.1f}%"
                    f" PPG:{contact_label}"
                )
                self._publish_telemetry(enriched_frame)
                self.last_telemetry_time = now

                # 将当前生理状态推送到 Dashboard 的陈伴日志（每次遥测同步）
                status_summary = (
                    f"心率 {fused_hr:.0f}bpm（{rule_label}），"
                    f"呼吸率 {r_resp:.0f}/min，"
                    f"体动 {r_mov:.1f}，"
                    f"BVI {bvi:.1f}，"
                    f"SpO₂ {ppg_spo2:.1f}%"
                )
                push_companion_log("system", status_summary, log_type="status")

        except Exception as e:
            logger.error(f"Frame processing error: {e}", exc_info=True)

    # ----------------------------------------------------------
    # 心率融合算法 v2.6（四规则语义框架）
    # ----------------------------------------------------------
    def _fuse_heart_rate(self, radar_hr: float, ppg_hr: float,
                         motion: float = 0.0) -> tuple:
        """
        心率数据融合 v2.6 - 四规则语义框架

        核心思路：
        不依赖 Q 值阈值（SEN0203 的 Q 值天然偏低，永远达不到阈值）。
        改用四条语义明确的规则，按优先级依次判断：

        规则优先级（从高到低）：
        ┌────────────────────────────────────┬──────────────────────────┐
        │ 情况                               │ 处理方式                  │
        ├────────────────────────────────────┼──────────────────────────┤
        │ 雷达高(>120) + PPG正常(40-120)     │ 信任PPG（体动干扰雷达）   │
        │ PPG突变(与上次差>30) + 雷达正常    │ 信任雷达，忽略PPG         │
        │ 两者都异常(差>40且都超出40-120)    │ 保持上次融合值不变        │
        │ 差值 ≤ 40bpm（默认情况）           │ 两者都可信，加权融合       │
        └────────────────────────────────────┴──────────────────────────┘

        规则4内部权重（体动动态决定）：
          motion > 30 → 雷达35% + PPG65%（体动干扰雷达，PPG更可靠）
          motion > 10 → 雷达45% + PPG55%
          motion ≤ 10 → 雷达55% + PPG45%（静止时雷达略优）

        + 5帧滑动窗口平滑，消除单帧突变

        Returns:
            (fused_hr: float, rule_label: str)
        """
        radar_valid = 30.0 < radar_hr < 200.0
        ppg_valid   = 30.0 < ppg_hr   < 200.0

        # v2.7修复：雷达心率归零处理
        # R60ABD1 雷达在目标体动较大或瞬时遮挡时 hr_r 会输出 0，这是硬件正常行为。
        # 不应立即切换 PPG-ONLY，而是使用上次有效雷达心率作为临时替代（最多 3 帧≈ 15 秒）。
        # 只有连续 3 帧雷达心率都为 0 时，才真正认为雷达无效。
        if radar_valid:
            self._last_valid_radar_hr = radar_hr
            self._radar_zero_count    = 0
        else:
            self._radar_zero_count += 1
            if self._radar_zero_count <= 3 and self._last_valid_radar_hr > 0:
                # 使用上次有效雷达心率替代（短暂归零容错）
                radar_hr    = self._last_valid_radar_hr
                radar_valid = True

        # ── 边界情况：单传感器有效 ──
        if not radar_valid and not ppg_valid:
            return self._last_fused_hr, "HOLD"

        if not radar_valid:
            # 雷达连续归零超过3帧，才真正切换 PPG-ONLY
            self._fused_hr_window.append(ppg_hr)
            result = round(sum(self._fused_hr_window) / len(self._fused_hr_window), 1)
            self._last_fused_hr = result
            self._prev_ppg_hr   = ppg_hr
            return result, "PPG-ONLY"

        if not ppg_valid:
            self._fused_hr_window.append(radar_hr)
            result = round(sum(self._fused_hr_window) / len(self._fused_hr_window), 1)
            self._last_fused_hr = result
            return result, "RADAR-ONLY"

        # ── 两者均有效，进入四规则判断 ──
        diff         = abs(ppg_hr - radar_hr)
        radar_normal = self.HR_NORMAL_MIN <= radar_hr <= self.HR_NORMAL_MAX
        ppg_normal   = self.HR_NORMAL_MIN <= ppg_hr   <= self.HR_NORMAL_MAX
        ppg_spike    = (
            self._prev_ppg_hr > 0.0 and
            abs(ppg_hr - self._prev_ppg_hr) > self.PPG_SPIKE_THRESH
        )

        # ── 规则一（最高优先级）：雷达偏高 + PPG正常 → 信任PPG ──
        # v2.8：阈值从 R>120 降低到 R>100，老人静息心率很少超过100bpm
        # 场景：体动导致雷达虚高，此时不管差值大小，只要PPG正常就信任PPG
        if not radar_normal and ppg_normal:
            raw_result = float(ppg_hr)
            rule_label = "RULE1:PPG"
            logger.debug(
                f"[Fusion] RULE1 R={radar_hr:.0f}(高>120) P={ppg_hr:.0f}(正常)"
                f" → 信任PPG"
            )

        # ── 规则2：PPG突变 + 雷达正常 → 信任雷达 ──
        # 场景：手指松动/噪声导致PPG跳变，不管差值大小，只要雷达正常就信任雷达
        # 注：必须在规则3之前判断，否则PPG突变且差值>40时会错误走规则3
        elif ppg_spike and radar_normal:
            raw_result = float(radar_hr)
            rule_label = "RULE2:RADAR"
            logger.debug(
                f"[Fusion] RULE2 PPG突变 {self._prev_ppg_hr:.0f}→{ppg_hr:.0f}"
                f" R={radar_hr:.0f}(正常) → 信任雷达"
            )

        # ── 规则3：两者都异常 → 保持上次值 ──
        # 场景：两个传感器同时失效（如剧烈运动后），不输出垃圾数据
        elif diff > self.FUSION_DIFF_MAX and not radar_normal and not ppg_normal:
            rule_label = "RULE3:HOLD"
            logger.debug(
                f"[Fusion] RULE3 diff={diff:.0f} R={radar_hr:.0f} P={ppg_hr:.0f}"
                f" 两者都异常 → 保持 {self._last_fused_hr:.0f}bpm"
            )
            self._prev_ppg_hr = ppg_hr
            return self._last_fused_hr, rule_label  # 不进入滑动窗口

        # ── 规则4（默认）：差值 ≤ 40bpm → 加权融合 ──
        # 包含两种子情况：
        #   a) 差值 ≤ 40：两者都可信，体动决定权重
        #   b) 差值 > 40 但不满足规则1/2/3（如雷达高但PPG也异常）：雷达主导
        elif diff <= self.FUSION_DIFF_MAX:
            if motion > 30:
                w_r, w_p = 0.35, 0.65   # 大体动：PPG更可靠
            elif motion > 10:
                w_r, w_p = 0.45, 0.55
            else:
                w_r, w_p = 0.55, 0.45   # 静止：雷达略优
            raw_result = radar_hr * w_r + ppg_hr * w_p
            rule_label = f"RULE4:R{w_r*100:.0f}+P{w_p*100:.0f}"
            logger.debug(
                f"[Fusion] RULE4 diff={diff:.0f} motion={motion:.0f}"
                f" R{w_r*100:.0f}%+P{w_p*100:.0f}% → {raw_result:.1f}bpm"
            )

        else:
            # 差值>40但不满足规则1/2/3（如雷达高但PPG也异常）：雷达主导
            raw_result = radar_hr * 0.80 + ppg_hr * 0.20
            rule_label = "RULE4:RADAR-MAIN"
            logger.debug(
                f"[Fusion] RULE4 diff={diff:.0f}>40 → 雷达主导 {raw_result:.1f}bpm"
            )

        # ── 5帧滑动窗口平滑 ──
        self._fused_hr_window.append(raw_result)
        smoothed = sum(self._fused_hr_window) / len(self._fused_hr_window)
        result   = round(smoothed, 1)

        self._last_fused_hr = result
        self._prev_ppg_hr   = ppg_hr
        return result, rule_label

    # ----------------------------------------------------------
    # MQTT 发布
    # ----------------------------------------------------------
    def _publish_telemetry(self, data: dict):
        """发布遥测数据到 MQTT Dashboard"""
        mqtt_ok = self.mqtt_connected  # HTTP push continues even without MQTT
        payload = {
            "device_id":    "jetson_nano_001",
            "timestamp":    time.time(),
            # 主要字段
            "hr":           data.get("fused_hr", 0),
            "br":           data.get("r_resp", 0),
            "motion":       data.get("r_mov", 0),
            "exist":        1 if data.get("r_exist", 0) == 1 else 0,
            "bvi":          data.get("bvi", 0),
            "bvi_trend":    data.get("bvi_trend", "stable"),
            "fusion_rule":  data.get("fusion_rule", ""),
            # PPG 字段
            "ppg_hr":       data.get("ppg_hr", 0),
            "ppg_spo2":     data.get("ppg_spo2", 0),
            "ppg_quality":  data.get("ppg_quality", 0),
            # 兼容旧字段名（Dashboard 向后兼容）
            "heart_rate":   data.get("fused_hr", 0),
            "resp_rate":    data.get("r_resp", 0),
            "movement":     data.get("r_mov", 0),
            "trend":        data.get("bvi_trend", "stable"),
            "tts_mode":     data.get("tts_mode", "print"),
            "voice_enabled": self.voice_manager is not None,
        }
        if mqtt_ok:
            try:
                self.mqtt_client.publish(
                    MQTT_TOPIC_TELEMETRY,
                    json.dumps(payload, ensure_ascii=False)
                )
            except Exception as e:
                logger.debug(f"Telemetry publish failed: {e}")
        # 推送到 Guardian Dashboard
        push_vitals({
            "radar_hr":     data.get("r_hr", 0),          # 雷达原始心率
            "rr":           data.get("r_resp", 0),         # 呼吸率
            "movement":     data.get("r_mov", 0),          # 体动强度
            "bvi":          data.get("bvi", 0),            # 行为活力指数
            "ppg_hr":       data.get("ppg_hr", 0),         # PPG 心率
            "ppg_spo2":     data.get("ppg_spo2", 98.0),    # 血氧饱和度
            "ppg_quality":  data.get("ppg_quality", 0),    # PPG 信号质量
            "ppg_valid":    data.get("ppg_spo2", 0) > 0,  # PPG 是否有效
            "hr_fusion":    data.get("fused_hr", 0),       # 融合心率（主显示字段）
            "fusion_rule":  data.get("fusion_rule", "RULE4"),
            "target_id":    "Human" if data.get("is_human", False) else "None",
        })

    def _publish_alert(self, alert_type: str, severity: str,
                       message: str, data: dict):
        """发布报警到 MQTT 和 Guardian Dashboard"""
        logger.warning(f"[ALERT] {alert_type}({severity}): {message[:60]}")

        # ① MQTT 发布（可选，断网时自动跳过）
        if self.mqtt_connected:
            payload = {
                "type":      alert_type,
                "severity":  severity,
                "message":   message,
                "timestamp": time.time(),
                "device_id": "jetson_nano_001",
            }
            try:
                self.mqtt_client.publish(
                    MQTT_TOPIC_ALERT,
                    json.dumps(payload, ensure_ascii=False)
                )
            except Exception as e:
                logger.debug(f"MQTT alert publish failed: {e}")

        # ② Dashboard HTTP 推送（不依赖 MQTT，独立运作）
        push_alert(alert_type, severity, message)
    # ----------------------------------------------------------
    # 优雅退出
    # ----------------------------------------------------------
    def _shutdown(self, signum, frame):
        logger.info("Shutting down gracefully...")
        self.running = False
        try:
            self.mqtt_client.loop_stop()
            self.mqtt_client.disconnect()
        except Exception:
            pass
        sys.exit(0)

    # ----------------------------------------------------------
    # 主运行循环
    # ----------------------------------------------------------
    def run(self):
        """
        主循环：从 STM32 串口读取数据并处理
        如果串口不可用，自动切换到模拟数据模式（用于测试）
        """
        logger.info("Starting main data loop (v2.6 Four-Rule Fusion)...")
        self.tts.speak("系统启动完成，开始守护模式。")
        self.agent.start()

        ser = None
        try:
            ser = serial.Serial(STM32_PORT, STM32_BAUD, timeout=1)
            logger.info(f"STM32 connected on {STM32_PORT} @ {STM32_BAUD}bps")
        except serial.SerialException as e:
            logger.warning(f"STM32 not found ({e}), running in simulation mode.")

        while self.running:
            if ser and ser.is_open:
                # ── 真实硬件模式 ──
                try:
                    line = ser.readline().decode("utf-8", errors="ignore").strip()
                    if line.startswith("{") and line.endswith("}"):
                        raw_frame = json.loads(line)
                        frame = normalize_frame(raw_frame, self.ppg_calculator)
                        self.process_sensor_frame(frame)
                except json.JSONDecodeError:
                    pass  # 忽略不完整的 JSON 行
                except serial.SerialException as e:
                    logger.error(f"Serial error: {e}")
                    ser = None  # 触发重连逻辑
                except Exception as e:
                    logger.debug(f"Serial read error: {e}")
            else:
                # ── 模拟数据模式（测试/演示用）──
                # PPG 幅度修正为真实 SEN0203 水平（约 150 ADC units）
                import math
                t = time.time()
                ppg_sim = int(
                    2048
                    + 75 * math.sin(t * 2 * math.pi * 1.2)   # 基波（心率 72bpm）
                    + 20 * math.sin(t * 2 * math.pi * 2.4)   # 谐波
                )
                ppg_sim = max(0, min(4095, ppg_sim))
                sim_raw = {
                    "ts":      int(t * 1000),
                    "hr_r":    int(72 + math.sin(t * 0.05) * 8),
                    "br_r":    int(16 + math.sin(t * 0.03) * 2),
                    "motion":  abs(math.sin(t * 0.2)) * 4,
                    "exist":   1,
                    "sleep":   0,
                    "score":   0,
                    "br_info": 1,
                    "ppg":     ppg_sim,
                }
                frame = normalize_frame(sim_raw, self.ppg_calculator)
                self.process_sensor_frame(frame)
                time.sleep(0.02)  # 模拟 50Hz 采样率


# ============================================================
# 程序入口
# ============================================================
if __name__ == "__main__":
    controller = CompanionSystemController()
    controller.run()
