import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
    FadeIn,
    FadeOut,
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withSequence,
    withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getIncidentColor, getIncidentIconName } from '../../incidents/utils/incidentIcons';
import { IncidentTypeFromAPI } from '../../incidents/types/incident.types';

interface IncidentAlertProps {
    incidentId: string;
    incidentName: string;
    distance: string;
    distanceKm: number;
    incidentType: IncidentTypeFromAPI;
    onDismiss?: () => void;
    topOffset?: number;
}

const ICON_SIZE = 52;
const LABEL_HEIGHT = 40;
// How long the name label stays fully revealed before collapsing back to the icon.
const REVEAL_HOLD_MS = 2500;

export const IncidentAlert: React.FC<IncidentAlertProps> = ({
    incidentId,
    incidentName,
    distance,
    incidentType,
    topOffset = 185,
}) => {
    const insets = useSafeAreaInsets();
    const color = getIncidentColor(incidentType);
    const iconName = getIncidentIconName(incidentType) as keyof typeof Ionicons.glyphMap;

    const [contentWidth, setContentWidth] = useState(0);
    const progress = useSharedValue(0);
    const revealedForRef = useRef<string | null>(null);

    const label = distance ? `${incidentName}  ·  ${distance}` : incidentName;

    const runReveal = () => {
        if (contentWidth <= 0) return;
        progress.value = 0;
        progress.value = withSequence(
            withTiming(1, { duration: 350, easing: Easing.out(Easing.cubic) }),
            withDelay(REVEAL_HOLD_MS, withTiming(0, { duration: 300, easing: Easing.in(Easing.cubic) }))
        );
    };

    useEffect(() => {
        if (contentWidth <= 0) return;
        if (revealedForRef.current === incidentId) return;
        revealedForRef.current = incidentId;
        runReveal();
    }, [contentWidth, incidentId]);

    const labelStyle = useAnimatedStyle(() => ({
        width: progress.value * contentWidth,
        opacity: progress.value,
    }));

    return (
        <Animated.View
            entering={FadeIn.duration(250)}
            exiting={FadeOut.duration(250)}
            style={{
                position: 'absolute',
                top: insets.top + topOffset,
                right: 16,
                zIndex: 10000,
                elevation: 10,
                flexDirection: 'row',
                alignItems: 'center',
            }}
        >
            <Animated.View style={[{ overflow: 'hidden' }, labelStyle]}>
                <View
                    style={{
                        backgroundColor: color,
                        height: LABEL_HEIGHT,
                        borderTopLeftRadius: LABEL_HEIGHT / 2,
                        borderBottomLeftRadius: LABEL_HEIGHT / 2,
                        paddingLeft: 16,
                        paddingRight: 24,
                        justifyContent: 'center',
                    }}
                >
                    <Text
                        numberOfLines={1}
                        style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}
                    >
                        {label}
                    </Text>
                </View>
            </Animated.View>

            {/* Persistent circular icon badge (stays at the right edge) */}
            <TouchableOpacity
                activeOpacity={0.7}
                onPress={runReveal}
                style={{
                    width: ICON_SIZE,
                    height: ICON_SIZE,
                    borderRadius: ICON_SIZE / 2,
                    backgroundColor: color,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 3,
                    borderColor: '#fff',
                    marginLeft: -16,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.25,
                    shadowRadius: 4,
                    elevation: 6,
                }}
            >
                <Ionicons name={iconName} size={26} color="#fff" />
            </TouchableOpacity>

            {/* Hidden measurer: reports the label's natural width for the reveal animation */}
            <View
                pointerEvents="none"
                style={{ position: 'absolute', opacity: 0, right: 0 }}
                onLayout={(e) => setContentWidth(e.nativeEvent.layout.width)}
            >
                <View style={{ paddingLeft: 16, paddingRight: 24 }}>
                    <Text style={{ fontWeight: '700', fontSize: 15 }}>{label}</Text>
                </View>
            </View>
        </Animated.View>
    );
};
