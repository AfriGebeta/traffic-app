import * as Application from 'expo-application';

export const getVersion = (): string => Application.nativeApplicationVersion ?? '0.0.0';
export const getBundleId = (): string => Application.applicationId ?? '';

export default { getVersion, getBundleId };
