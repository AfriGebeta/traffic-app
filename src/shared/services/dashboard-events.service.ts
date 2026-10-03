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
  | 'VOICE_SESSION'
  | 'SEARCH_RESULT_SELECTED'
  | 'SEARCH_NO_RESULTS'
  | 'NAVIGATION_STARTED'
  | 'NAVIGATION_COMPLETED'
  | 'NAVIGATION_CANCELLED'
  | 'NAVIGATION_REROUTED'
  | 'ROUTE_ALTERNATIVE_SELECTED';

export type RerouteReason = 'off_route' | 'traffic' | 'manual';

const round = (value: number, digits = 2): number => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

class DashboardEventsService {
  private async sendEvent(type: DashboardEventType, metadata?: Record<string, any>): Promise<void> {
    try {
      const deviceId = await telemetryService.getDeviceId();
      const payload = { type, deviceId, ...(metadata ? { metadata } : {}) };
      console.log('dashboard events: sending', JSON.stringify(payload));
      const result = await apiService.post('/api/telemetry/event', payload);
      if (result.error) {
        console.warn('dashboard events: error response', type, result.status, result.error);
      } else {
        console.log('dashboard events: success', type, JSON.stringify(result.data));
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
    void this.sendEvent('VOICE_SESSION');
  }

  searchResultSelected(query: string, placeId: string, resultIndex: number): void {
    void this.sendEvent('SEARCH_RESULT_SELECTED', { query, placeId, resultIndex });
  }

  searchNoResults(query: string): void {
    void this.sendEvent('SEARCH_NO_RESULTS', { query });
  }

  navigationStarted(params: {
    navigationId: string;
    originLat: number;
    originLng: number;
    destinationLat: number;
    destinationLng: number;
    distanceMeters: number;
    durationSeconds: number;
  }): void {
    void this.sendEvent('NAVIGATION_STARTED', {
      navigationId: params.navigationId,
      originLat: params.originLat,
      originLng: params.originLng,
      destinationLat: params.destinationLat,
      destinationLng: params.destinationLng,
      distanceKm: round(params.distanceMeters / 1000),
      etaMin: Math.round(params.durationSeconds / 60),
    });
  }

  navigationCompleted(navigationId: string, elapsedMs: number, distanceMeters: number): void {
    void this.sendEvent('NAVIGATION_COMPLETED', {
      navigationId,
      actualDurationMin: Math.round(elapsedMs / 60000),
      distanceKm: round(distanceMeters / 1000),
    });
  }

  navigationCancelled(navigationId: string, elapsedMs: number, remainingMeters: number): void {
    void this.sendEvent('NAVIGATION_CANCELLED', {
      navigationId,
      elapsedMin: Math.round(elapsedMs / 60000),
      remainingKm: round(remainingMeters / 1000),
    });
  }

  navigationRerouted(navigationId: string, reason: RerouteReason): void {
    void this.sendEvent('NAVIGATION_REROUTED', { navigationId, reason });
  }

  routeAlternativeSelected(routeIndex: number): void {
    void this.sendEvent('ROUTE_ALTERNATIVE_SELECTED', { routeIndex });
  }
}

export const dashboardEventsService = new DashboardEventsService();
