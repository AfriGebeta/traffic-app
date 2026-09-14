import React, { createContext, useContext, useId } from 'react';
import { Platform, View, type ViewProps } from 'react-native';
import { requireNativeView, requireOptionalNativeModule } from 'expo';

// old development builds and Android < 12 retain the existing glass treatment.
export const supportsMapBlur = Platform.OS === 'android'
    && Number(Platform.Version) >= 31
    && requireOptionalNativeModule('MapGlass') !== null;

const Target = supportsMapBlur
    ? requireNativeView<ViewProps & { targetId: string }>('MapGlass', 'Target')
    : null;
const Blur = supportsMapBlur
    ? requireNativeView<ViewProps & { targetId: string; radius: number }>('MapGlass', 'Blur')
    : null;
const TargetContext = createContext<string | null>(null);

export function MapGlassProvider({ children }: React.PropsWithChildren) {
    const id = useId();
    return <TargetContext.Provider value={id}>{children}</TargetContext.Provider>;
}

export function MapGlassTarget(props: ViewProps) {
    const targetId = useContext(TargetContext);
    return Target && targetId
        ? <Target {...props} targetId={targetId} />
        : <View {...props} />;
}

export function MapGlassBlur({ radius = 10, ...props }: ViewProps & { radius?: number }) {
    const targetId = useContext(TargetContext);
    return Blur && targetId ? <Blur {...props} targetId={targetId} radius={radius} /> : null;
}
