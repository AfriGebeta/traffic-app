import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from './api';
import telemetryService from './telemetry.service';

const INSTALL_SENT_KEY = '@dashboard_install_sent';

type DashboardEventType =
  | 'SESSION_START'
  | 'INSTALL'
  | 'ONBOARD_COMPLETE'
  | 'SEARCH'
  | 'ROUTE_GENERATED'
  | 'CONTRIBUTE'
  | 'VOICE_SESSION';

class DashboardEventsService {
  private async sendEvent(type: DashboardEventType, metadata?: Record<string, any>): Promise<void> {
    try {
      const deviceId = await telemetryService.getDeviceId();
      const payload = { type, deviceId, ...(metadata ? { metadata } : {}) };
      // console.log('dashboard events: sending:', payload);
      const result = await apiService.post('/api/telemetry/event', payload);
      if (result.error) {
        console.warn('dashboard events: error response:', result.error);
      } else {
        // console.log('dashboard events: success:', type);
      }
    } catch (e) {
      console.error('dashboard events: threw:', e);
    }
  }

  sessionStart(): void {
    // console.log('dashboard events: SESSION_START triggered');
    void this.sendEvent('SESSION_START');
  }

  async installOnce(): Promise<void> {
    try {
      const alreadySent = await AsyncStorage.getItem(INSTALL_SENT_KEY);
      if (alreadySent) {
        // console.log('dashboard events: INSTALL already sent, skipping');
        return;
      }
      await this.sendEvent('INSTALL');
      await AsyncStorage.setItem(INSTALL_SENT_KEY, 'true');
    } catch (e) {
      console.error('dashboard events: INSTALL threw:', e);
    }
  }

  onboardComplete(): void {
    // console.log('dashboard events: ONBOARD_COMPLETE triggered');
    void this.sendEvent('ONBOARD_COMPLETE');
  }

  search(query: string): void {
    // console.log('dashboard events: SEARCH triggered, query:', query);
    void this.sendEvent('SEARCH', { query });
  }

  routeGenerated(): void {
    // console.log('dashboard events: ROUTE_GENERATED triggered');
    void this.sendEvent('ROUTE_GENERATED');
  }

  contribute(): void {
    // console.log('dashboard events: CONTRIBUTE triggered');
    void this.sendEvent('CONTRIBUTE');
  }

  voiceSession(): void {
    // console.log('dashboard events: VOICE_SESSION triggered');
    void this.sendEvent('VOICE_SESSION');
  }
}

export const dashboardEventsService = new DashboardEventsService();
