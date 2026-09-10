import React, { useId, useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { GlassStrength, useGlass } from '../theme/glass';
import { MapGlassBlur } from '../../../modules/map-glass';

interface GlassSheenProps {
    streak?: boolean;
    radius?: number;
    strength?: GlassStrength;
}

export const GlassSheen: React.FC<GlassSheenProps> = ({
    streak = false,
    radius = 999,
    strength = 'regular',
}) => {
    const { isDark, sheen, fill, rim } = useGlass();
    const id = useId().replace(/:/g, '');
    const [size, setSize] = useState({ width: 0, height: 0 });
    const corner = Math.min(radius, size.width / 2, size.height / 2);

    return (
        <View
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            onLayout={({ nativeEvent: { layout } }) => {
                setSize(previous => previous.width === layout.width && previous.height === layout.height
                    ? previous : { width: layout.width, height: layout.height });
            }}
            style={[styles.material, { borderRadius: radius }]}
        >
            <MapGlassBlur
                radius={strength === 'thin' ? 5 : strength === 'thick' ? 8.5 : 7.25}
                style={StyleSheet.absoluteFillObject}
            />
            {Platform.OS === 'ios' && (
                <BlurView
                    tint={isDark ? 'systemUltraThinMaterialDark' : 'systemUltraThinMaterialLight'}
                    intensity={strength === 'thin' ? 12 : 17}
                    style={StyleSheet.absoluteFillObject}
                />
            )}
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: fill(strength) }]} />
            {size.width > 0 && size.height > 0 && (
                <Svg width={size.width} height={size.height} style={StyleSheet.absoluteFillObject}>
                    <Defs>
                        <LinearGradient id={`${id}body`} x1="0%" y1="0%" x2="0%" y2="100%">
                            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={sheen.top} />
                            <Stop offset="0.42" stopColor="#FFFFFF" stopOpacity={0.015} />
                            <Stop offset="0.72" stopColor="#FFFFFF" stopOpacity={0} />
                            <Stop offset="1" stopColor="#0B1820" stopOpacity={sheen.bottom} />
                        </LinearGradient>
                        <LinearGradient id={`${id}rim`} x1="0%" y1="0%" x2="35%" y2="100%">
                            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={sheen.edge} />
                            <Stop offset="0.35" stopColor="#FFFFFF" stopOpacity={0.12} />
                            <Stop offset="0.65" stopColor="#FFFFFF" stopOpacity={0.03} />
                            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={sheen.edge * 0.45} />
                        </LinearGradient>
                        <LinearGradient id={`${id}streak`} x1="0%" y1="0%" x2="100%" y2="100%">
                            <Stop offset="0.12" stopColor="#FFFFFF" stopOpacity={0} />
                            <Stop offset="0.36" stopColor="#FFFFFF" stopOpacity={sheen.streak} />
                            <Stop offset="0.62" stopColor="#FFFFFF" stopOpacity={0} />
                        </LinearGradient>
                    </Defs>
                    <Rect width="100%" height="100%" fill={`url(#${id}body)`} />
                    {streak && <Rect width="100%" height="100%" fill={`url(#${id}streak)`} />}
                    <Rect x={0.5} y={0.5} width={size.width - 1} height={size.height - 1}
                        rx={Math.max(0, corner - 0.5)} fill="none" stroke={rim} strokeWidth={1} />
                    <Rect x={1.25} y={1.25} width={Math.max(0, size.width - 2.5)} height={Math.max(0, size.height - 2.5)}
                        rx={Math.max(0, corner - 1.25)} fill="none" stroke={`url(#${id}rim)`} strokeWidth={0.75} />
                </Svg>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    material: {
        ...StyleSheet.absoluteFillObject,
        overflow: 'hidden',
    },
});
