# Guardian Dashboard - TODO

## 核心功能
- [x] 实时监控页面（心率/呼吸率/BVI/体动）
- [x] 心率/呼吸率实时波形图（60秒滚动）
- [x] 融合心率算法展示（RULE1-4）
- [x] PPG传感器状态（心率为0时显示--）
- [x] 目标识别(CA1)展示
- [x] 活力指数(BVI)页面 + 24h趋势图
- [x] 报警记录页面（分级过滤、确认功能）
- [x] AI陪伴日志页面（对话气泡、Agent工作流）
- [x] 每日报告页面（AI健康摘要生成）
- [x] 中英文切换
- [x] 模拟跌倒按钮

## 演示模式
- [x] 5种情境切换（正常/心率偏高/跌倒/夜间/血氧低）
- [x] 情境数据平滑生成

## MQTT 实时接入
- [x] 后端 WebSocket 代理（/ws/mqtt-proxy）
- [x] 解决 HTTPS 页面无法连接 ws:// 的问题
- [x] 前端 MQTT 配置面板（Broker地址/Topic/用户名/密码）
- [x] 修复配置面板连接按钮（异步state问题）
- [x] MQTT连接状态实时显示

## 待完善
- [ ] 报警推送通知（浏览器 Notification API）
- [ ] BVI历史周/月对比图
- [ ] Daily Report 使用真实数据生成
- [x] 修复侧边栏MQTT"配置"按钮点击无响应问题（配置面板现在直接内嵌在侧边栏）
- [x] 实现后端 HTTP POST API 接收 Jetson 数据（带 API Key 鉴权）
- [x] 后端 WebSocket 实时推送数据到浏览器
- [x] 前端通过 WebSocket 接收实时数据替代演示模式
- [x] 生成 Jetson Python 推送代码片段（jetson_push_data.py）
- [x] 移除 MQTT 配置面板，改为 Demo/Realtime 双模式切换
