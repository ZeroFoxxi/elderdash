#!/usr/bin/env python3
"""
Guardian Dashboard - Jetson Nano Data Push Script
==================================================
将此脚本放到 Jetson Nano 上，与 main_v2_fixed.py 一起运行。
此脚本负责将传感器数据通过 HTTP POST 推送到云端 Dashboard。

用法:
  python3 jetson_push_data.py                    # 独立运行（测试用）
  nohup python3 jetson_push_data.py > /tmp/push.log 2>&1 &   # 后台运行

集成到 main_v2_fixed.py:
  在主循环末尾调用 push_vitals(data_dict) 即可

依赖:
  pip3 install requests
"""

import requests
import json
import time
import logging
import threading
from datetime import datetime

# ─── 配置 ────────────────────────────────────────────────────────────────────
# ⚠️  重要：Dashboard 地址已更新为最新部署版本
DASHBOARD_URL = "https://elderdash-ky9k6ssp.manus.space"
API_KEY = "guardian-jetson-2024"
PUSH_INTERVAL = 5  # 每5秒推送一次
DEVICE_ID = "jetson-b01"
TIMEOUT = 10  # HTTP请求超时秒数

# ─── 日志配置 ─────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger("guardian-push")

# ─── 全局状态 ─────────────────────────────────────────────────────────────────
_last_push_ok = False
_push_count = 0
_error_count = 0
_consecutive_errors = 0  # 连续失败计数（用于退避重试）


def push_vitals(data: dict) -> bool:
    """
    推送生理数据到 Dashboard。
    
    参数 data 字段（来自 main_v2_fixed.py 的输出）:
      - hr_fusion: float     融合心率 bpm
      - rr: float            呼吸率 /min
      - movement: float      体动强度 0-200
      - bvi: float           活力指数 0-100
      - ppg_hr: float        PPG心率 bpm（0表示无信号）
      - ppg_spo2: float      血氧 %
      - ppg_quality: float   PPG信号质量 0-100
      - ppg_valid: bool      PPG是否有效
      - radar_hr: float      雷达心率 bpm
      - fusion_rule: str     融合规则 RULE1/RULE2/RULE3/RULE4
      - target_id: str       目标识别 "Human"/"Pet"/"None"
    """
    global _last_push_ok, _push_count, _error_count, _consecutive_errors
    
    # 构建推送数据
    payload = {
        "apiKey": API_KEY,
        "deviceId": DEVICE_ID,
        "radarHr": float(data.get("radar_hr", 0)),
        "radarRr": float(data.get("rr", 0)),
        "movement": float(data.get("movement", 0)),
        "targetId": str(data.get("target_id", "None")),
        "ppgHr": float(data.get("ppg_hr", 0)),
        "ppgSpo2": float(data.get("ppg_spo2", 0)),
        "ppgSignalQuality": float(data.get("ppg_quality", 0)),
        "ppgConnected": bool(data.get("ppg_valid", False)),
        "fusedHr": float(data.get("hr_fusion", 0)),
        "fusedMethod": str(data.get("fusion_rule", "RULE1")),
        "bvi": float(data.get("bvi", 0)),
    }
    
    try:
        resp = requests.post(
            f"{DASHBOARD_URL}/api/ingest/vitals",
            json=payload,
            timeout=TIMEOUT,
            headers={"Content-Type": "application/json"}
        )
        if resp.status_code == 200:
            _last_push_ok = True
            _push_count += 1
            _consecutive_errors = 0
            if _push_count % 12 == 1:  # 每分钟打印一次
                logger.info(f"[OK] Pushed vitals #{_push_count} | HR={payload['fusedHr']:.0f} bpm, RR={payload['radarRr']:.0f}/min, BVI={payload['bvi']:.0f}")
            return True
        elif resp.status_code == 401:
            logger.error(f"[ERR] API Key 无效，请检查 API_KEY 配置（当前：{API_KEY}）")
            return False
        else:
            _last_push_ok = False
            _error_count += 1
            _consecutive_errors += 1
            logger.warning(f"[WARN] Push failed: HTTP {resp.status_code} - {resp.text[:100]}")
            return False
    except requests.exceptions.ConnectionError:
        _last_push_ok = False
        _error_count += 1
        _consecutive_errors += 1
        if _consecutive_errors == 1 or _consecutive_errors % 12 == 0:
            logger.error(f"[ERR] 无法连接到 Dashboard ({DASHBOARD_URL}) - 请检查网络连接")
        return False
    except requests.exceptions.Timeout:
        _last_push_ok = False
        _error_count += 1
        _consecutive_errors += 1
        logger.error("[ERR] 请求超时 - Dashboard 响应慢，请检查网络")
        return False
    except Exception as e:
        _last_push_ok = False
        _error_count += 1
        _consecutive_errors += 1
        logger.error(f"[ERR] Unexpected error: {e}")
        return False


def push_alert(alert_type: str, severity: str, message: str, message_zh: str = "") -> bool:
    """
    推送报警事件到 Dashboard。
    
    参数:
      alert_type: "fall" | "hr_high" | "hr_low" | "spo2_low" | "bvi_low"
      severity:   "critical" | "warning" | "info"
      message:    英文消息
      message_zh: 中文消息（可选）
    
    示例:
      push_alert("fall", "critical", "Fall detected!", "检测到跌倒！")
      push_alert("hr_high", "warning", "HR elevated 122 bpm", "心率偏高 122 bpm")
    """
    payload = {
        "apiKey": API_KEY,
        "deviceId": DEVICE_ID,
        "alertType": alert_type,
        "severity": severity,
        "message": message,
        "messageZh": message_zh,
    }
    
    try:
        resp = requests.post(
            f"{DASHBOARD_URL}/api/ingest/alert",
            json=payload,
            timeout=TIMEOUT,
        )
        if resp.status_code == 200:
            logger.info(f"[ALERT] Pushed: {alert_type} ({severity}) - {message}")
            return True
        else:
            logger.warning(f"[WARN] Alert push failed: HTTP {resp.status_code}")
            return False
    except Exception as e:
        logger.error(f"[ERR] Alert push error: {e}")
        return False


def push_companion_log(role: str, content: str, log_type: str = "chat") -> bool:
    """
    推送 AI 陪伴对话日志到 Dashboard。
    
    参数:
      role:     "user" | "assistant" | "system"
      content:  对话内容
      log_type: "chat" | "patrol" | "alert_response"
    """
    payload = {
        "apiKey": API_KEY,
        "deviceId": DEVICE_ID,
        "role": role,
        "content": content,
        "logType": log_type,
    }
    
    try:
        resp = requests.post(
            f"{DASHBOARD_URL}/api/ingest/companion",
            json=payload,
            timeout=TIMEOUT,
        )
        return resp.status_code == 200
    except Exception as e:
        logger.error(f"[ERR] Companion log push error: {e}")
        return False


def check_connection() -> bool:
    """检查与 Dashboard 的连接是否正常"""
    try:
        resp = requests.get(f"{DASHBOARD_URL}/api/ingest/status", timeout=5)
        if resp.status_code == 200:
            data = resp.json()
            logger.info(f"[OK] Dashboard 连接成功 | 当前观看浏览器数: {data.get('connectedBrowsers', 0)}")
            logger.info(f"[OK] Dashboard URL: {DASHBOARD_URL}")
            return True
        return False
    except Exception as e:
        logger.error(f"[ERR] 无法连接到 Dashboard: {e}")
        logger.error(f"[ERR] 目标地址: {DASHBOARD_URL}")
        return False


def get_status() -> dict:
    """获取推送状态统计"""
    return {
        "dashboard_url": DASHBOARD_URL,
        "push_count": _push_count,
        "error_count": _error_count,
        "last_push_ok": _last_push_ok,
        "consecutive_errors": _consecutive_errors,
    }


# ─── 独立运行模式（测试用） ───────────────────────────────────────────────────
if __name__ == "__main__":
    logger.info("=" * 60)
    logger.info("Guardian Dashboard - Jetson Push Script")
    logger.info(f"Target: {DASHBOARD_URL}")
    logger.info(f"Device: {DEVICE_ID}")
    logger.info(f"Interval: {PUSH_INTERVAL}s")
    logger.info("=" * 60)
    
    # 检查连接
    if not check_connection():
        logger.warning("Dashboard 暂时不可达，将持续重试...")
    
    # 模拟数据循环（实际使用时替换为真实传感器数据）
    import math
    tick = 0
    
    while True:
        tick += 1
        
        # 模拟传感器数据（替换为你的实际数据）
        simulated_data = {
            "radar_hr": 75 + math.sin(tick / 60) * 6,
            "rr": 16 + math.sin(tick / 45) * 2,
            "movement": 2.5 + math.sin(tick / 120) * 1.5,
            "bvi": 65 + math.sin(tick / 200) * 15,
            "ppg_hr": 74 + math.sin(tick / 55) * 5,
            "ppg_spo2": 98,
            "ppg_quality": 80,
            "ppg_valid": True,
            "hr_fusion": 74.6 + math.sin(tick / 60) * 5,
            "fusion_rule": "RULE4",
            "target_id": "Human",
        }
        
        push_vitals(simulated_data)
        
        # 模拟偶发报警（每30次推送一次测试报警）
        if tick % 30 == 0:
            push_alert(
                "hr_high", "warning",
                f"Heart rate elevated {simulated_data['hr_fusion']:.0f} bpm",
                f"心率偏高 {simulated_data['hr_fusion']:.0f} bpm"
            )
        
        time.sleep(PUSH_INTERVAL)
