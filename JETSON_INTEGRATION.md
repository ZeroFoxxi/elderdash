# Jetson Nano → Dashboard 实时数据接入指南

## 架构说明

```
Jetson Nano (Python)
  ↓ HTTP POST (每5秒)
Cloud Dashboard API (https://elderdash-ff68zyqh.manus.space)
  ↓ WebSocket 广播
Browser Dashboard (实时显示)
```

## 快速开始

### 1. 将脚本上传到 Jetson

通过 WinSCP 将 `jetson_push_data.py` 上传到 Jetson Nano：
```
本地路径: jetson_push_data.py
Jetson路径: /home/jetson/companion_new/jetson_push_data.py
```

### 2. 安装依赖

```bash
pip3 install requests
```

### 3. 集成到 main_v2_fixed.py

在 `main_v2_fixed.py` 的主循环中添加以下代码：

```python
# ─── 在文件顶部导入 ───────────────────────────────────────────────
from jetson_push_data import push_vitals, push_alert, push_companion_log

# ─── 在主循环末尾调用（每次循环结束时） ──────────────────────────
# 构建数据字典（字段名与你的变量对应）
dashboard_data = {
    "radar_hr": radar_hr,          # 雷达心率
    "rr": radar_rr,                # 呼吸率
    "movement": movement_level,    # 体动强度
    "bvi": bvi_score,              # 活力指数
    "ppg_hr": ppg_heart_rate,      # PPG心率（无信号时为0）
    "ppg_spo2": ppg_spo2,          # 血氧
    "ppg_quality": ppg_quality,    # PPG信号质量 0-100
    "ppg_valid": ppg_connected,    # PPG是否有效
    "hr_fusion": fused_hr,         # 融合心率
    "fusion_rule": fusion_rule,    # 融合规则 RULE1-RULE4
    "target_id": target_label,     # "Human"/"Pet"/"None"
}
push_vitals(dashboard_data)

# ─── 报警时调用 ──────────────────────────────────────────────────
# 跌倒报警
if fall_detected:
    push_alert("fall", "critical",
               "Fall detected! Please confirm elderly status.",
               "检测到跌倒！请立即确认老人状态！")

# 心率偏高
if fused_hr > 100:
    push_alert("hr_high", "warning",
               f"Heart rate elevated {fused_hr:.0f} bpm",
               f"心率偏高 {fused_hr:.0f} bpm")

# 血氧偏低
if ppg_spo2 < 95 and ppg_connected:
    push_alert("spo2_low", "critical",
               f"SpO2 low ({ppg_spo2:.0f}%)",
               f"血氧偏低（{ppg_spo2:.0f}%）")

# ─── AI 对话时调用 ───────────────────────────────────────────────
# AI 说话
push_companion_log("assistant", ai_response_text, "chat")
# 用户说话
push_companion_log("user", user_input_text, "chat")
# 系统事件
push_companion_log("system", "Hourly patrol initiated", "patrol")
```

### 4. 后台运行

```bash
# 后台运行主程序（已包含push功能）
cd /home/jetson/companion_new
nohup python3 main_v2_fixed.py > /tmp/companion.log 2>&1 &

# 查看日志
tail -f /tmp/companion.log
```

### 5. 验证连接

```bash
# 测试Dashboard是否可达
curl https://elderdash-ff68zyqh.manus.space/api/ingest/status

# 手动推送一条测试数据
curl -X POST https://elderdash-ff68zyqh.manus.space/api/ingest/vitals \
  -H "Content-Type: application/json" \
  -d '{"apiKey":"guardian-jetson-2024","radarHr":75,"radarRr":16,"movement":2.5,"targetId":"Human","ppgHr":74,"ppgSpo2":98,"ppgSignalQuality":80,"ppgConnected":true,"fusedHr":74.6,"fusedMethod":"RULE4","bvi":65}'
```

## API 参考

### POST /api/ingest/vitals

| 字段 | 类型 | 说明 |
|------|------|------|
| apiKey | string | `guardian-jetson-2024` |
| radarHr | number | 雷达心率 bpm |
| radarRr | number | 呼吸率 /min |
| movement | number | 体动强度 0-200 |
| targetId | string | "Human" / "Pet" / "None" |
| ppgHr | number | PPG心率 bpm（0=无信号）|
| ppgSpo2 | number | 血氧 % |
| ppgSignalQuality | number | 信号质量 0-100 |
| ppgConnected | boolean | PPG是否连接 |
| fusedHr | number | 融合心率 bpm |
| fusedMethod | string | RULE1/RULE2/RULE3/RULE4 |
| bvi | number | 活力指数 0-100 |
| deviceId | string | 设备ID（可选，默认"jetson-b01"）|

### POST /api/ingest/alert

| 字段 | 类型 | 说明 |
|------|------|------|
| apiKey | string | `guardian-jetson-2024` |
| alertType | string | fall / hr_high / hr_low / spo2_low / bvi_low |
| severity | string | critical / warning / info |
| message | string | 英文消息 |
| messageZh | string | 中文消息（可选）|

### POST /api/ingest/companion

| 字段 | 类型 | 说明 |
|------|------|------|
| apiKey | string | `guardian-jetson-2024` |
| role | string | user / assistant / system |
| content | string | 对话内容 |
| logType | string | chat / patrol / alert_response |

## Dashboard 操作

1. 打开 https://elderdash-ff68zyqh.manus.space
2. 点击侧边栏底部的 **演示模式** 按钮
3. 切换到 **实时** 标签
4. 等待 Jetson 连接（顶部状态栏会显示 "● Jetson 实时"）

## 故障排查

| 问题 | 原因 | 解决方法 |
|------|------|----------|
| 连接失败 | 网络问题 | 检查 Jetson 是否有公网访问 |
| 401 错误 | API Key 错误 | 确认 apiKey 为 `guardian-jetson-2024` |
| 数据不显示 | 未切换到实时模式 | Dashboard 侧边栏切换到"实时"模式 |
| 心率显示0 | 字段名错误 | 检查 radarHr/fusedHr 字段是否正确 |
