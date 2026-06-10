/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ObligationAlert } from './obligations';

export interface NotificationState {
  permission: NotificationPermission;
  fcmToken: string | null;
  subscribed: boolean;
}

class NotificationServiceManager {
  private state: NotificationState = {
    permission: 'default',
    fcmToken: null,
    subscribed: false,
  };

  constructor() {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      this.state.permission = Notification.permission;
      const cachedToken = localStorage.getItem('fcm_token_cached');
      const cachedSub = localStorage.getItem('fcm_subscribed_active') === 'true';
      if (cachedToken) {
        this.state.fcmToken = cachedToken;
        this.state.subscribed = cachedSub;
      }
    }
  }

  getState(): NotificationState {
    return { ...this.state };
  }

  async requestPermission(): Promise<NotificationState> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return this.state;
    }

    const permission = await Notification.requestPermission();
    this.state.permission = permission;

    if (permission === 'granted') {
      // Generate a simulated registration token (matching standard FCM token specifications)
      const mockToken = 'fcm_token_live_' + Math.random().toString(36).substring(2, 10).toUpperCase() + 
                        '_node_' + Math.random().toString(36).substring(2, 10).toUpperCase();
      
      this.state.fcmToken = mockToken;
      this.state.subscribed = true;
      localStorage.setItem('fcm_token_cached', mockToken);
      localStorage.setItem('fcm_subscribed_active', 'true');
    } else {
      this.state.fcmToken = null;
      this.state.subscribed = false;
      localStorage.removeItem('fcm_token_cached');
      localStorage.setItem('fcm_subscribed_active', 'false');
    }

    return this.getState();
  }

  // Trigger a push notification on screen
  sendLocalNotification(title: string, body: string) {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      console.warn("System notifications not supported in this frame.");
      return;
    }

    if (this.state.permission === 'granted') {
      try {
        const option = {
          body: body,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          tag: 'farm-alert-system',
          requireInteraction: true // keeps it on screen until user clicks
        };
        new Notification(title, option);
      } catch (err) {
        console.error("Failed to construct system notification", err);
      }
    } else {
      console.log(`Notification log (permission ${this.state.permission}): [${title}] ${body}`);
    }
  }

  // Scans all obligations & tasks to alert on pending items
  checkAndAlert(alerts: ObligationAlert[]) {
    if (alerts.length === 0) return;

    const overdueCount = alerts.filter(a => a.daysRemaining < 0).length;
    const dueTodayCount = alerts.filter(a => a.daysRemaining === 0).length;

    if (overdueCount > 0 || dueTodayCount > 0) {
      let message = '';
      if (dueTodayCount > 0) {
        message += `${dueTodayCount} obrigação(ões) vencendo HOJE. `;
      }
      if (overdueCount > 0) {
        message += `${overdueCount} obrigação(ões) com prazo ULTRAPASSADO.`;
      }

      this.sendLocalNotification(
        '⚠️ Alertas da Fazenda Online',
        `${message} Clique para abrir a Central de Obrigações.`
      );
    }
  }
}

export const NotificationService = new NotificationServiceManager();
