// Guardian Dashboard - Alert History Page
// CA1 Improvement: Human/Pet Discrimination

import { useState } from 'react';
import { AlertCircle, AlertTriangle, Info, Check, CheckCheck, Filter, PawPrint } from 'lucide-react';
import { useDashboard } from '../contexts/DashboardContext';
import type { AlertData } from '../lib/types';

type FilterType = 'all' | 'critical' | 'warning' | 'info';

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
  const { alerts, unackedCount, acknowledgeAlert, acknowledgeAll, isEnglish } = useDashboard();
  const [filter, setFilter] = useState<FilterType>('all');
  const [showPetFiltered, setShowPetFiltered] = useState(false);

  const filtered = alerts.filter(a => {
    if (filter === 'all') return true;
    if (filter === 'critical') return a.severity === 'Critical';
    if (filter === 'warning') return a.severity === 'Warning';
    if (filter === 'info') return a.severity === 'Info';
    return true;
  });

  const criticalCount = alerts.filter(a => a.severity === 'Critical').length;

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      {/* Header */}
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

      {/* Filter Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filter === 'all' ? 'bg-primary text-primary-foreground' : 'bg-white border border-border text-muted-foreground hover:bg-muted'
            }`}
          >
            {isEnglish ? 'All' : '全部'} ({alerts.length})
          </button>
          <button
            onClick={() => setFilter('critical')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filter === 'critical' ? 'bg-red-500 text-white' : 'bg-white border border-border text-muted-foreground hover:bg-muted'
            }`}
          >
            {isEnglish ? 'Critical' : '严重'} ({criticalCount})
          </button>
          <button
            onClick={() => setFilter('warning')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filter === 'warning' ? 'bg-amber-500 text-white' : 'bg-white border border-border text-muted-foreground hover:bg-muted'
            }`}
          >
            {isEnglish ? 'Warning' : '警告'} ({alerts.filter(a => a.severity === 'Warning').length})
          </button>
          <button
            onClick={() => setFilter('info')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filter === 'info' ? 'bg-blue-500 text-white' : 'bg-white border border-border text-muted-foreground hover:bg-muted'
            }`}
          >
            {isEnglish ? 'Info' : '信息'} ({alerts.filter(a => a.severity === 'Info').length})
          </button>
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

      {/* Alert List */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl p-8 border border-border text-center">
            <Check size={24} className="text-emerald-400 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">{isEnglish ? 'No alerts in this category' : '此分类暂无报警'}</p>
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
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-bold text-foreground uppercase tracking-wide">
                      {alert.type}
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
        <div className="grid grid-cols-4 gap-4">
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
      </div>
    </div>
  );
}
