import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import telemetryService, { TelemetryData } from './telemetry.service';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;
const TELEMETRY_SENT_KEY = '@telemetry_already_sent';

export interface TelemetryEvent {
  eventName: string;
  eventData?: Record<string, any>;
  telemetry: TelemetryData;
}

class TelemetryApiService {

  private async hasBeenSent(): Promise<boolean> {
    try {
      const sent = await AsyncStorage.getItem(TELEMETRY_SENT_KEY);
      return sent === 'true';
    } catch (error) {
      console.error('Error checking telemetry status:', error);
      return false;
    }
  }


  private async markAsSent(): Promise<void> {
    try {
      await AsyncStorage.setItem(TELEMETRY_SENT_KEY, 'true');
      await AsyncStorage.setItem('@telemetry_sent_date', new Date().toISOString());
    } catch (error) {
      console.error('Error marking telemetry as sent:', error);
    }
  }

  /**
   * @param forceAlways - set to true to bypass already sent
   */
  async sendTelemetry(eventName: string, eventData?: Record<string, any>, forceAlways = false): Promise<boolean> {
    try {
      if (!forceAlways && eventName === 'app_launch') {
        const alreadySent = await this.hasBeenSent();
        if (alreadySent) {
          console.log('telemetry already sent , skipping');
          return false;
        }
      }

      const telemetryData = await telemetryService.collectTelemetryData();

      const payload: TelemetryEvent = {
        eventName,
        eventData,
        telemetry: telemetryData,
      };

      await axios.post(`${API_BASE_URL}/api/users/telemetry`, payload, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log(`telemetry sent: ${eventName}`);

      if (eventName === 'app_launch') {
        await this.markAsSent();
      }

      return true;
    } catch (error) {
      console.error('failed to send telemetry:', error);
      return false;
    }
  }

  async trackAppLaunch(): Promise<void> {
    await this.sendTelemetry('app_launch');
  }

  async trackLogin(userId: string): Promise<void> {
    await this.sendTelemetry('user_login', { userId }, true);
  }

  async trackNavigation(from: string, to: string): Promise<void> {
    await this.sendTelemetry('navigation', { from, to });
  }

  async trackFeatureUsage(featureName: string, metadata?: Record<string, any>): Promise<void> {
    await this.sendTelemetry('feature_usage', { featureName, ...metadata });
  }

  async trackError(error: Error, context?: Record<string, any>): Promise<void> {
    await this.sendTelemetry('error', {
      message: error.message,
      stack: error.stack,
      ...context,
    }, true);
  }

  async sendHeartbeat(): Promise<void> {
    await this.sendTelemetry('heartbeat');
  }
}

export default new TelemetryApiService();
