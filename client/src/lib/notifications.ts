// Guardian Dashboard - Browser Notification Utility
// Handles permission requests and desktop notification dispatch for alerts

export type NotificationSeverity = 'Critical' | 'Warning' | 'Info';

/**
 * Request browser notification permission from the user.
 * Returns the resulting permission state.
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  return await Notification.requestPermission();
}

/**
 * Check if browser notifications are supported and granted.
 */
export function isNotificationGranted(): boolean {
  return 'Notification' in window && Notification.permission === 'granted';
}

/**
 * Get current notification permission state.
 */
export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

interface AlertNotificationOptions {
  alertType: string;
  severity: NotificationSeverity;
  message: string;
  isEnglish?: boolean;
}

/**
 * Send a desktop notification for a new alert event.
 */
export function sendAlertNotification({ alertType, severity, message, isEnglish = false }: AlertNotificationOptions): void {
  if (!isNotificationGranted()) return;

  const severityEmoji: Record<NotificationSeverity, string> = {
    Critical: '🚨',
    Warning: '⚠️',
    Info: 'ℹ️',
  };

  const title = isEnglish
    ? `${severityEmoji[severity]} Guardian Alert: ${alertType}`
    : `${severityEmoji[severity]} 守护报警：${alertType}`;

  const body = message.length > 100 ? message.slice(0, 97) + '...' : message;

  const iconMap: Record<NotificationSeverity, string> = {
    Critical: '/favicon.ico',
    Warning: '/favicon.ico',
    Info: '/favicon.ico',
  };

  try {
    const notification = new Notification(title, {
      body,
      icon: iconMap[severity],
      badge: '/favicon.ico',
      tag: `guardian-alert-${alertType}-${Date.now()}`,
      requireInteraction: severity === 'Critical', // Critical alerts stay until dismissed
    });

    // Auto-close non-critical notifications after 8 seconds
    if (severity !== 'Critical') {
      setTimeout(() => notification.close(), 8000);
    }

    // Click to focus the tab
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } catch (e) {
    console.warn('[Notifications] Failed to send notification:', e);
  }
}
