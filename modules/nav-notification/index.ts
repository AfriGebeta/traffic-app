import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

type NavNotificationNative = { update(body: string): Promise<boolean> };

//android only native
const native =
  Platform.OS === 'android'
    ? requireOptionalNativeModule<NavNotificationNative>('NavNotification')
    : null;

export async function updateNativeNavNotification(body: string): Promise<boolean> {
  if (!native) return false;
  try {
    return await native.update(body);
  } catch {
    return false;
  }
}
