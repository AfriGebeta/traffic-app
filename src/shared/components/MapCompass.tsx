import React, { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, ViewStyle } from 'react-native';
import Svg, { Circle, Path, G } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme/ThemeContext';
import { useGlass } from '../theme/glass';
import { GlassSheen } from './GlassSheen';

export interface MapCompassRef {
    // camera bearing in degrees (clockwise from north), as MapLibre region events report it
    setHeading: (heading: number) => void;
}

interface MapCompassProps {
    onPress: () => void;
    style?: ViewStyle;
    size?: number;
    glyphSize?: number;
}

const NORTH_RED = '#E5484D';
// like the native compass: stay hidden while the map is (near) north-up
const VISIBLE_THRESHOLD_DEG = 0.5;
const HIDE_DELAY_MS = 450;

export const MapCompass = forwardRef<MapCompassRef, MapCompassProps>(({ onPress, style, size = 44, glyphSize }, ref) => {
    const { t } = useTranslation();
    const { colors: theme, isDark } = useTheme();
    const glass = useGlass();

    const rotation = useRef(new Animated.Value(0)).current;
    const opacity = useRef(new Animated.Value(0)).current;
    const [visible, setVisible] = useState(false);
    const visibleRef = useRef(false);
    const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const show = useCallback((next: boolean) => {
        if (next) {
            if (hideTimerRef.current) {
                clearTimeout(hideTimerRef.current);
                hideTimerRef.current = null;
            }
            if (visibleRef.current) return;
            visibleRef.current = true;
            setVisible(true);
            Animated.timing(opacity, {
                toValue: 1,
                duration: 160,
                easing: Easing.out(Easing.quad),
                useNativeDriver: true,
            }).start();
            return;
        }
        if (!visibleRef.current || hideTimerRef.current) return;
        hideTimerRef.current = setTimeout(() => {
            hideTimerRef.current = null;
            visibleRef.current = false;
            setVisible(false);
            Animated.timing(opacity, {
                toValue: 0,
                duration: 220,
                easing: Easing.in(Easing.quad),
                useNativeDriver: true,
            }).start();
        }, HIDE_DELAY_MS);
    }, [opacity]);

    useImperativeHandle(ref, () => ({
        setHeading: (heading: number) => {
            if (!Number.isFinite(heading)) return;
            const normalized = ((heading % 360) + 360) % 360;
            // shortest signed offset from north, so the needle never spins the long way
            const signed = normalized > 180 ? normalized - 360 : normalized;
            rotation.setValue(-signed);
            show(Math.abs(signed) > VISIBLE_THRESHOLD_DEG);
        },
    }), [rotation, show]);

    React.useEffect(() => () => {
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    }, []);

    const spin = rotation.interpolate({
        inputRange: [-180, 180],
        outputRange: ['-180deg', '180deg'],
    });

    const c = size / 2;
    const g = glyphSize ?? size;
    const needleHalf = g * 0.3;
    const needleWidth = g * 0.105;
    const southColor = isDark ? 'rgba(242,242,242,0.85)' : 'rgba(26,26,26,0.55)';
    const tickColor = isDark ? 'rgba(242,242,242,0.35)' : 'rgba(26,26,26,0.22)';
    const ringR = g * 0.4;

    return (
        <Animated.View
            pointerEvents={visible ? 'auto' : 'none'}
            style={[styles.wrap, { width: size, height: size, opacity }, style]}
        >
            <Pressable
                onPress={onPress}
                accessibilityRole="button"
                accessibilityLabel={t('reset-north')}
                hitSlop={8}
                style={[styles.button, glass.surface, { width: size, height: size, borderRadius: size / 2 }]}
            >
                <GlassSheen />
                <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate: spin }] }]}>
                    <Svg width={size} height={size}>
                        <G>
                            {/* east/south/west ticks; north is carried by the red needle */}
                            {[90, 180, 270].map(angle => {
                                const rad = (angle * Math.PI) / 180;
                                const outer = ringR;
                                const inner = ringR - g * 0.05;
                                return (
                                    <Path
                                        key={angle}
                                        d={`M ${c + inner * Math.sin(rad)} ${c - inner * Math.cos(rad)} L ${c + outer * Math.sin(rad)} ${c - outer * Math.cos(rad)}`}
                                        stroke={tickColor}
                                        strokeWidth={1.25}
                                        strokeLinecap="round"
                                    />
                                );
                            })}
                            <Path
                                d={`M ${c} ${c - needleHalf} L ${c + needleWidth} ${c} L ${c - needleWidth} ${c} Z`}
                                fill={NORTH_RED}
                            />
                            <Path
                                d={`M ${c} ${c + needleHalf} L ${c + needleWidth} ${c} L ${c - needleWidth} ${c} Z`}
                                fill={southColor}
                            />
                            <Circle cx={c} cy={c} r={g * 0.045} fill={theme.textPrimary} />
                            <Circle cx={c} cy={c} r={g * 0.022} fill={isDark ? '#1A1A1A' : '#FFFFFF'} />
                        </G>
                    </Svg>
                </Animated.View>
            </Pressable>
        </Animated.View>
    );
});

MapCompass.displayName = 'MapCompass';

const styles = StyleSheet.create({
    wrap: {
        position: 'absolute',
    },
    button: {
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'visible',
    },
});
