import * as Device from 'expo-device';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const DEVICE_ID_KEY = '@telemetry_device_id';

export interface TelemetryData {
  appVersion: string;
  appBuildNumber: string | null;
  appName: string;
  bundleId: string;
  
  deviceId: string;
  deviceName: string | null;
  deviceType: Device.DeviceType | null;
  manufacturer: string | null;
  modelName: string | null;
  modelId: string | null;
  osName: string | null;
  osVersion: string | null;
  osBuildId: string | null;
  platformApiLevel: number | null;
  
  brand: string | null;
  designName: string | null;
  productName: string | null;
  totalMemory: number | null;
  supportedCpuArchitectures: string[] | null;
  
  androidId: string | null;
  installationId: string;
  sessionId: string;
  
  platform: 'ios' | 'android' | 'web';
  isDevice: boolean;
  
  timestamp: string;
}

class TelemetryService {
  private sessionId: string;
  
  constructor() {
    this.sessionId = this.generateUUID();
  }

  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }


  private async getDeviceId(): Promise<string> {
    try {
      let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
      
      if (!deviceId) {
        deviceId = this.generateUUID();
        await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
      }
      
      return deviceId;
    } catch (error) {
      console.error('Failed to get/create device ID:', error);
      return this.generateUUID();
    }
  }

  async collectTelemetryData(): Promise<TelemetryData> {
    const deviceId = await this.getDeviceId();
    
    const data: TelemetryData = {
      appVersion: Constants.expoConfig?.version || '1.0.0',
      appBuildNumber: null,
      appName: Constants.expoConfig?.name || 'Gebeta Maps',
      bundleId: Constants.expoConfig?.slug || 'gebeta-maps',
      
      deviceId,
      deviceName: Device.deviceName,
      deviceType: Device.deviceType,
      manufacturer: Device.manufacturer,
      modelName: Device.modelName,
      modelId: Device.modelId,
      osName: Device.osName,
      osVersion: Device.osVersion,
      osBuildId: Device.osBuildId,
      platformApiLevel: Device.platformApiLevel,
      
      brand: Device.brand,
      designName: Device.designName,
      productName: Device.productName,
      totalMemory: Device.totalMemory,
      supportedCpuArchitectures: Device.supportedCpuArchitectures,
      
      androidId: null, 
      installationId: Constants.sessionId || this.generateUUID(),
      sessionId: this.sessionId,
      
      platform: Platform.OS as 'ios' | 'android' | 'web',
      isDevice: Device.isDevice,
      
      timestamp: new Date().toISOString(),
    };
    
    return data;
  }

  async getTelemetrySummary(): Promise<{
    appVersion: string;
    platform: string;
    deviceModel: string;
    osVersion: string;
    deviceId: string;
  }> {
    const deviceId = await this.getDeviceId();
    
    return {
      appVersion: Constants.expoConfig?.version || '1.0.0',
      platform: Platform.OS,
      deviceModel: Device.modelName || 'Unknown',
      osVersion: Device.osVersion || 'Unknown',
      deviceId,
    };
  }

  async logTelemetryToConsole(): Promise<void> {
    const data = await this.collectTelemetryData();
    
    // console.log('\n' + '='.repeat(60));
    // console.log('telemetry data');
    // console.log('='.repeat(60));
    
    // console.log('\n app info:');
    // console.log(`App Name: ${data.appName}`);
    // console.log(`Version: ${data.appVersion}`);
    // console.log(`Build Number: ${data.appBuildNumber || 'N/A'}`);
    // console.log(`Bundle ID: ${data.bundleId}`);
    // console.log(`Platform: ${data.platform}`);
    
    // console.log('\n device info:');
    // console.log(`Device Name: ${data.deviceName || 'N/A'}`);
    // console.log(`Manufacturer: ${data.manufacturer || 'N/A'}`);
    // console.log(`Brand: ${data.brand || 'N/A'}`);
    // console.log(`Model Name: ${data.modelName || 'N/A'}`);
    // console.log(`Model ID: ${data.modelId || 'N/A'}`);
    // console.log(`Is Physical Device: ${data.isDevice ? 'Yes' : 'No (emulator)'}`);
    
    // console.log('\n os:');
    // console.log(`OS Name: ${data.osName || 'N/A'}`);
    // console.log(`OS Version: ${data.osVersion || 'N/A'}`);
    // console.log(`OS Build ID: ${data.osBuildId || 'N/A'}`);
    // console.log(`Platform API Level: ${data.platformApiLevel || 'N/A'}`);
    
    // console.log('\n hardware specs:');
    // console.log(`Total Memory: ${data.totalMemory ? (data.totalMemory / (1024 * 1024 * 1024)).toFixed(2) + ' GB' : 'N/A'}`);
    // console.log(`CPU Architectures: ${data.supportedCpuArchitectures?.join(', ') || 'N/A'}`);
    // console.log(`Design Name: ${data.designName || 'N/A'}`);
    // console.log(`Product Name: ${data.productName || 'N/A'}`);
    
    // console.log('\n unique ids:');
    // console.log(`Device ID: ${data.deviceId}`);
    // console.log(`Session ID: ${data.sessionId}`);
    // console.log(`Installation ID: ${data.installationId}`);
    // console.log(`Android ID: ${data.androidId || 'N/A (requires expo-application)'}`);
    
    // console.log('\ntimestamp:');
    // console.log(` Collected At: ${new Date(data.timestamp).toLocaleString()}`);
    // console.log(` ISO Format: ${data.timestamp}`);
    
    // console.log('\n' + '='.repeat(60));
    // console.log('raw json:');
    // console.log('='.repeat(60));
    // console.log(JSON.stringify(data, null, 2));
    // console.log('='.repeat(60) + '\n');
  }


  getSessionId(): string {
    return this.sessionId;
  }

  resetSession(): void {
    this.sessionId = this.generateUUID();
  }
}

export default new TelemetryService();
