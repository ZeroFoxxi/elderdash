// Guardian Dashboard - Alert History Page
// CA1 Improvement: Human/Pet Discrimination
// Feature: Filter by severity AND alert type

import { useState } from 'react';
import { AlertCircle, AlertTriangle, Info, Check, CheckCheck, Filter, PawPrint, Bell, BellOff, BellRing, X } from 'lucide-react';
import { useDashboard } from '../contexts/DashboardContext';
import type { AlertData } from '../lib/types';
import { toast } from 'sonner';

type FilterType = 'all' | 'critical' | 'warning' | 'info';

// Alert type labels for display
const ALERT_TYPE_LABELS: Record<string, { en: string; zh: string; color: string }> = {
  fall:      { en: 'Fall',       zh: '跌倒',   color: '#ef4444' },
  hr_high:   { en: 'HR High',    zh: '心率偏高', color: '#f59e0b' },
  hr_low:    { en: 'HR Low',     zh: '心率偏低', color: '#3b82f6' },
  spo2_low:  { en: 'SpO₂ Low',  zh: '血氧偏低', color: '#8b5cf6' },
  bvi_low:   { en: 'BVI Low',    zh: 'BVI偏低', color: '#f97316' },
  nocturnal: { en: 'Nocturnal',  zh: '夜间异常', color: '#6366f1' },
};

function getAlertTypeLabel(type: string, isEnglish: boolean): string {
  const label = ALERT_TYPE_LABELS[type.toLowerCase()];
  if (label) return isEnglish ? label.en : label.zh;
  return type.toUpperCase();
}

function getAlertTypeColor(type: string): string {
  return ALERT_TYPE_LABELS[type.toLowerCase()]?.color ?? '#6b7280';
}

function getSeverityIcon(severity: AlertData['severity']) {
  switch (severity) {
    case 'Critical': return <AlertCircle size={16} className="text-red-500" />;
    case 'Warning': return <AlertTriangle size={16} className="text-amber-500" />;
    case 'Info': return <Info size={16} className="text-blue-400" />;
  }
}

function getSeverityBadge(severity: AlertData['severity'], isEnglish: boolean) {
  const styles = {
    Critical: 'bg-red-50 text-red-600 border-red-200',
    Warning: 'bg-amber-50 text-amber-600 border-amber-200',
    Info: 'bg-blue-50 text-blue-600 border-blue-200',
  };
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${styles[severity]}`}>
      {severity}
    </span>
  );
}

export default function AlertHistory() {
  const {
    alerts, unackedCount, acknowledgeAlert, acknowledgeAll, isEnglish,
    notificationPermission, requestNotifications, notificationsEnabled, toggleNotifications,
  } = useDashboard();
  const [filter, setFilter] = useState<FilterType>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showPetFiltered, setShowPetFiltered] = useState(false);

  // Collect unique alert types from current alerts
  const alertTypes = Array.from(new Set(alerts.map(a => a.type.toLowerCase()))).sort();

  const filtered = alerts.filter(a => {
    const severityOk =
      filter === 'all' ||
      (filter === 'critical' && a.severity === 'Critical') ||
      (filter === 'warning' && a.severity === 'Warning') ||
      (filter === 'info' && a.severity === 'Info');
    const typeOk = typeFilter === 'all' || a.type.toLowerCase() === typeFilter;
    return severityOk && typeOk;
  });

  const criticalCount = alerts.filter(a => a.severity === 'Critical').length;
  const hasActiveFilters = filter !== 'all' || typeFilter !== 'all';

  const handleNotificationToggle = async () => {
    if (notificationPermission === 'unsupported') {
      toast.error(isEnglish ? 'Browser notifications not supported' : '您的浏览器不支持桌面通知');
      return;
    }
    if (notificationPermission === 'denied') {
      toast.error(
        isEnglish
          ? 'Notification permission denied. Please enable in browser settings.'
          : '通知权限已被拒绝，请在浏览器设置中手动开启。'
      );
      return;
    }
    if (notificationPermission !== 'granted') {
      await requestNotifications();
      if (notificationPermission === 'granted') {
        toast.success(isEnglish ? 'Notifications enabled!' : '桌面通知已开启！');
      }
      return;
    }
    toggleNotifications();
    toast.success(
      notificationsEnabled
        ? (isEnglish ? 'Notifications disabled' : '通知已关闭')
        : (isEnglish ? 'Notifications enabled' : '通知已开启')
    );
  };

  const notificationButtonLabel = () => {
    if (notificationPermission === 'unsupported') return isEnglish ? 'Not Supported' : '不支持';
    if (notificationPermission === 'denied') return isEnglish ? 'Blocked' : '已屏蔽';
    if (notificationPermission !== 'granted') return isEnglish ? 'Enable Alerts' : '开启通知';
    return notificationsEnabled
      ? (isEnglish ? 'Alerts On' : '通知开启')
      : (isEnglish ? 'Alerts Off' : '通知关闭');
  };

  const notificationButtonStyle = () => {
    if (notificationPermission === 'denied' || notificationPermission === 'unsupported') {
      return 'bg-muted border-border text-muted-foreground cursor-not-allowed';
    }
    if (notificationPermission !== 'granted') {
      return 'bg-amber-50 border-amber-200 text-amber-600 hover:bg-amber-100';
    }
    return notificationsEnabled
      ? 'bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100'
      : 'bg-white border-border text-muted-foreground hover:bg-muted';
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-baseline gap-2">
            <h2 className="text-xl font-semibold text-foreground">
              {isEnglish ? 'Alert History' : '报警记录'}
            </h2>
            <span className="text-sm text-muted-foreground font-normal">Alert History</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isEnglish
              ? 'Fall Detection · Nocturnal Anomaly · Pet Filter'
              : 'Fall Detection · Nocturnal Anomaly · Pet Filter'}
          </p>
        </div>

        {/* Notification permission button */}
        <button
          onClick={handleNotificationToggle}
          disabled={notificationPermission === 'unsupported' || notificationPermission === 'denied'}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${notificationButtonStyle()}`}
          title={
            notificationPermission === 'denied'
              ? (isEnglish ? 'Notification permission denied in browser settings' : '通知权限已在浏览器中被拒绝')
              : (isEnglish ? 'Toggle desktop alert notifications' : '切换桌面报警通知')
          }
        >
          {notificationPermission === 'denied' || notificationPermission === 'unsupported' ? (
            <BellOff size={13} />
          ) : notificationPermission !== 'granted' ? (
            <BellRing size={13} />
          ) : notificationsEnabled ? (
            <Bell size={13} />
          ) : (
            <BellOff size={13} />
          )}
          {notificationButtonLabel()}
        </button>
      </div>

      {/* CA1 Improvement Banner */}
      <div className="bg-teal-50 border border-teal-200 rounded-xl px-4 py-3 flex items-start gap-2">
        <div className="w-3 h-3 rounded-full bg-teal-500 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-teal-700">
          <span className="font-semibold">CA1 Improvement: Human/Pet Discrimination — </span>
          {isEnglish
            ? 'System uses RCS energy threshold + target height dual-filter to auto-identify pets and suppress false alarms.'
            : '系统使用 RCS 能量阈值 + 目标高度双重过滤，自动识别宠物并抑制误报。'}
        </p>
      </div>

      {/* Notification permission prompt */}
      {notificationPermission === 'default' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <BellRing size={16} className="text-amber-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-xs font-medium text-amber-700">
              {isEnglish ? 'Enable desktop notifications for critical alerts' : '开启桌面通知，及时接收跌倒、心率异常等严重报警'}
            </p>
            <p className="text-[11px] text-amber-600 mt-0.5">
              {isEnglish
                ? 'Critical alerts (fall, abnormal HR) will show as desktop notifications even when the tab is in background.'
                : '严重报警（跌倒、心率异常等）将以桌面通知形式弹出，即使标签页在后台也能及时收到。'}
            </p>
          </div>
          <button
            onClick={requestNotifications}
            className="flex-shrink-0 px-3 py-1.5 bg-amber-500 text-white rounded-lg text-xs font-medium hover:bg-amber-600 transition-colors"
          >
            {isEnglish ? 'Allow' : '允许通知'}
          </button>
        </div>
      )}

      {/* ── Filter Panel ─────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-border p-4 space-y-3">
        {/* Severity filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] text-muted-foreground font-medium w-14 flex-shrink-0">
            {isEnglish ? 'Severity' : '严重度'}
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { key: 'all', label_zh: `全部 (${alerts.length})`, label_en: `All (${alerts.length})`, style: 'bg-primary text-primary-foreground', inactiveStyle: 'bg-white border border-border text-muted-foreground hover:bg-muted' },
              { key: 'critical', label_zh: `严重 (${criticalCount})`, label_en: `Critical (${criticalCount})`, style: 'bg-red-500 text-white', inactiveStyle: 'bg-white border border-border text-muted-foreground hover:bg-muted' },
              { key: 'warning', label_zh: `警告 (${alerts.filter(a => a.severity === 'Warning').length})`, label_en: `Warning (${alerts.filter(a => a.severity === 'Warning').length})`, style: 'bg-amber-500 text-white', inactiveStyle: 'bg-white border border-border text-muted-foreground hover:bg-muted' },
              { key: 'info', label_zh: `信息 (${alerts.filter(a => a.severity === 'Info').length})`, label_en: `Info (${alerts.filter(a => a.severity === 'Info').length})`, style: 'bg-blue-500 text-white', inactiveStyle: 'bg-white border border-border text-muted-foreground hover:bg-muted' },
            ].map(btn => (
              <button
                key={btn.key}
                onClick={() => setFilter(btn.key as FilterType)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filter === btn.key ? btn.style : btn.inactiveStyle}`}
              >
                {isEnglish ? btn.label_en : btn.label_zh}
              </button>
            ))}
          </div>
        </div>

        {/* Alert type filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] text-muted-foreground font-medium w-14 flex-shrink-0">
            {isEnglish ? 'Type' : '类型'}
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setTypeFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                typeFilter === 'all' ? 'bg-primary text-primary-foreground' : 'bg-white border border-border text-muted-foreground hover:bg-muted'
              }`}
            >
              {isEnglish ? 'All Types' : '全部类型'}
            </button>
            {alertTypes.map(type => {
              const count = alerts.filter(a => a.type.toLowerCase() === type).length;
              const color = getAlertTypeColor(type);
              const isActive = typeFilter === type;
              return (
                <button
                  key={type}
                  onClick={() => setTypeFilter(type)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${isActive ? 'text-white' : 'bg-white text-muted-foreground hover:bg-muted'}`}
                  style={isActive ? { backgroundColor: color, borderColor: color } : { borderColor: '#e5e7eb' }}
                >
                  {getAlertTypeLabel(type, isEnglish)} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Bottom row: clear filters + pet filter + ack all */}
        <div className="flex items-center justify-between pt-1 border-t border-border">
          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <button
                onClick={() => { setFilter('all'); setTypeFilter('all'); }}
                className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-muted-foreground hover:bg-muted transition-all"
              >
                <X size={10} />
                {isEnglish ? 'Clear Filters' : '清除筛选'}
              </button>
            )}
            <span className="text-[11px] text-muted-foreground">
              {isEnglish ? `Showing ${filtered.length} of ${alerts.length}` : `显示 ${filtered.length} / ${alerts.length} 条`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPetFiltered(prev => !prev)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] border transition-all ${
                showPetFiltered ? 'bg-amber-50 border-amber-200 text-amber-600' : 'bg-white border-border text-muted-foreground hover:bg-muted'
              }`}
            >
              <PawPrint size={11} />
              {isEnglish ? 'Pet Filtered' : '宠物过滤'}
            </button>
            {unackedCount > 0 && (
              <button
                onClick={acknowledgeAll}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] bg-white border border-border text-muted-foreground hover:bg-muted transition-all"
              >
                <CheckCheck size={11} />
                {isEnglish ? `Ack All (${unackedCount})` : `全部确认 (${unackedCount})`}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Alert List */}
      <div className="space-y-2">
        {
          filtered.length === 0 ? (
          <div className="bg-white rounded-xl p-8 border border-border text-center">
            <Check size={24} className="text-emerald-400 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">{isEnglish ? 'No alerts in this category' : '此分类暂无报警'}</p>
            {hasActiveFilters && (
              <button
                onClick={() => { setFilter('all'); setTypeFilter('all'); }}
                className="mt-2 text-xs text-primary hover:underline"
              >
                {isEnglish ? 'Clear filters to see all alerts' : '清除筛选以查看全部报警'}
              </button>
            )}
          </div>
        ) : (
          filtered.map((alert, index) => (
            <div
              key={index}
              className={`bg-white rounded-xl px-4 py-3 border transition-all ${
                alert.acknowledged ? 'border-border opacity-60' : 'border-border hover:border-primary/30 hover:shadow-sm'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex-shrink-0">
                  {getSeverityIcon(alert.severity)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span
                      className="text-sm font-bold uppercase tracking-wide"
                      style={{ color: getAlertTypeColor(alert.type) }}
                    >
                      {getAlertTypeLabel(alert.type, isEnglish)}
                    </span>
                    {getSeverityBadge(alert.severity, isEnglish)}
                    {alert.filtered_by_pet && (
                      <span className="flex items-center gap-1 text-[10px] bg-amber-50 text-amber-600 border border-amber-200 px-1.5 py-0.5 rounded">
                        <PawPrint size={9} />
                        {isEnglish ? 'Pet Filtered' : '宠物过滤'}
                      </span>
                    )}
                    {alert.acknowledged && (
                      <span className="flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-600 border border-emerald-200 px-1.5 py-0.5 rounded">
                        <Check size={9} />
                        {isEnglish ? 'Acknowledged' : '已确认'}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {isEnglish ? alert.message : alert.message_zh}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[11px] text-muted-foreground font-mono">{alert.timestamp}</span>
                  {!alert.acknowledged && (
                    <button
                      onClick={() => acknowledgeAlert(index)}
                      className="p-1 rounded hover:bg-muted transition-colors"
                      title={isEnglish ? 'Acknowledge' : '确认'}
                    >
                      <Check size={12} className="text-muted-foreground" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Alert Statistics */}
      <div className="bg-white rounded-xl p-5 border border-border shadow-sm">
        <h3 className="text-sm font-semibold text-foreground mb-4">
          {isEnglish ? 'Alert Statistics (24h)' : '报警统计（24小时）'}
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
          {[
            { label: isEnglish ? 'Total' : '总计', value: alerts.length, color: 'text-foreground' },
            { label: isEnglish ? 'Critical' : '严重', value: alerts.filter(a => a.severity === 'Critical').length, color: 'text-red-500' },
            { label: isEnglish ? 'Warning' : '警告', value: alerts.filter(a => a.severity === 'Warning').length, color: 'text-amber-500' },
            { label: isEnglish ? 'Unacknowledged' : '未确认', value: unackedCount, color: 'text-primary' },
          ].map(stat => (
            <div key={stat.label} className="text-center">
              <div className={`text-2xl font-bold font-mono ${stat.color}`}>{stat.value}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">{stat.label}</div>
            </div>
          ))}
        </div>
        {/* By type breakdown */}
        {alertTypes.length > 0 && (
          <div className="border-t border-border pt-3">
            <p className="text-[11px] text-muted-foreground mb-2">{isEnglish ? 'By Type' : '按类型'}</p>
            <div className="flex flex-wrap gap-2">
              {alertTypes.map(type => {
                const count = alerts.filter(a => a.type.toLowerCase() === type).length;
                const color = getAlertTypeColor(type);
                return (
                  <button
                    key={type}
                    onClick={() => setTypeFilter(typeFilter === type ? 'all' : type)}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-medium transition-all hover:opacity-80"
                    style={{
                      backgroundColor: `${color}15`,
                      color,
                      border: `1px solid ${color}40`,
                    }}
                  >
                    <span className="font-bold">{count}</span>
                    <span>{getAlertTypeLabel(type, isEnglish)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
