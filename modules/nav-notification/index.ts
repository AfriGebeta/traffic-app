import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

type NavNotificationNative = {
  update(body: string): Promise<boolean>;
  addListener(event: 'onNavExit', listener: () => void): { remove(): void };
};

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

export function addNavExitListener(listener: () => void): { remove(): void } {
  if (!native) return { remove: () => undefined };
  return native.addListener('onNavExit', listener);
}
