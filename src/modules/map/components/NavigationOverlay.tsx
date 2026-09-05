import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import Animated, {
    Easing,
    FadeOut,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeepAwake } from 'expo-keep-awake';
import { useTranslation } from 'react-i18next';
import { colors } from '../../../shared/theme/colors';
import { useTheme } from '../../../shared/theme/ThemeContext';
import NavigationDirectionBackground from '../../../../assets/images/navigation-direction-background.svg';
import { maneuverIcon } from '../../navigation/utils/instructionEngine';

const NAV_GREEN = '#1E5438';
const REPORT_HINT_HOLD_MS = 4000;

const BlinkingRuleIcon: React.FC<{ uri: string; size: number }> = ({ uri, size }) => {
    const opacity = useSharedValue(1);

    useEffect(() => {
        opacity.value = withRepeat(
            withTiming(0.15, { duration: 500, easing: Easing.inOut(Easing.ease) }),
            -1,
            true
        );
        return () => {
            opacity.value = 1;
        };
    }, [opacity, uri]);

    const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

    return (
        <Animated.View style={animatedStyle}>
            <Image
                source={{ uri }}
                style={{ width: size, height: size }}
                resizeMode="contain"
            />
        </Animated.View>
    );
};

interface ActiveRule {
    ruleId: string;
    ruleName: string;
    ruleImg: string;
}

interface NavigationOverlayProps {
    remainingTime?: number;
    remainingDistance?: number;
    totalRouteDistance?: number;
    destination?: string;
    destinationCoords?: { lat: number; lng: number };
    currentSpeed?: number;
    activeRule?: ActiveRule | null;
    onReportPress?: () => void;
    onExitPress?: () => void;
    isOffRoute?: boolean;
    isRecalculating?: boolean;
    onTestOffRoute?: () => void;
    showRecenterButton?: boolean;
    onRecenter?: () => void;
    currentInstruction?: string;
    maneuverType?: number;
}

const getDirectionIcon = (instruction?: string): keyof typeof Ionicons.glyphMap => {
    if (!instruction) return 'arrow-up';

    const lowerInstruction = instruction.toLowerCase();

    if (lowerInstruction.includes('u-turn') || lowerInstruction.includes('uturn')) return 'return-down-back';
    if (lowerInstruction.includes('left')) return 'arrow-back';
    if (lowerInstruction.includes('right')) return 'arrow-forward';
    if (lowerInstruction.includes('straight') || lowerInstruction.includes('continue')) return 'arrow-up';

    return 'arrow-up';
};

const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    if (minutes < 1) return '< 1 min';
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
};

export const NavigationOverlay: React.FC<NavigationOverlayProps> = ({
    remainingTime,
    remainingDistance,
    totalRouteDistance,
    destination,
    destinationCoords,
    currentSpeed = 0,
    activeRule,
    onReportPress,
    onExitPress,
    isRecalculating,
    // onTestOffRoute,
    showRecenterButton,
    onRecenter,
    currentInstruction,
    maneuverType,
}) => {
    useKeepAwake();
    const insets = useSafeAreaInsets();
    const { t } = useTranslation();
    const { colors: theme, isDark } = useTheme();
    const directionIcon = (maneuverType !== undefined
        ? maneuverIcon(maneuverType)
        : getDirectionIcon(currentInstruction)) as keyof typeof Ionicons.glyphMap;
    const [showReportHint, setShowReportHint] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => setShowReportHint(false), REPORT_HINT_HOLD_MS);
        return () => clearTimeout(timer);
    }, []);

    const getETA = () => {
        if (!remainingTime) return '--:--';
        const eta = new Date(Date.now() + remainingTime * 1000);
        return eta.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    };

    const routeProgress = (() => {
        if (!totalRouteDistance || totalRouteDistance <= 0 || remainingDistance == null) return 0;
        const traveled = totalRouteDistance - remainingDistance;
        return Math.min(1, Math.max(0, traveled / totalRouteDistance));
    })();

    return (
        <View className="absolute left-0 right-0 bottom-0">
            {isRecalculating && (
                <View className="items-center mb-3">
                    <View
                        className="flex-row items-center rounded-full"
                        style={{
                            backgroundColor: theme.surface,
                            paddingVertical: 12,
                            paddingHorizontal: 22,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.18,
                            shadowRadius: 6,
                            elevation: 5,
                        }}
                    >
                        <ActivityIndicator size="small" color="#0F9D58" />
                        <Text
                            className="font-semibold ml-2"
                            style={{ color: theme.textPrimary, fontSize: 16 }}
                        >
                            Recalculating route
                        </Text>
                    </View>
                </View>
            )}

            {/* {__DEV__ && onTestOffRoute && (
                <TouchableOpacity
                    className="mx-4 mb-2 border rounded-2xl py-2 flex-row items-center justify-center"
                    style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: '#EF4444' }}
                    onPress={onTestOffRoute}
                >
                    <Ionicons name="bug-outline" size={16} color="#EF4444" />
                    <Text className="text-red-500 text-sm font-bold ml-2">Test Off Route</Text>
                </TouchableOpacity>
            )} */}

            <View
                className="flex-row justify-between items-end"
                style={{ marginBottom: 10, paddingHorizontal: 20 }}
            >
                <View className="items-center" style={{ minWidth: 52 }}>
                    {activeRule ? (
                        <View
                            style={{
                                width: 48,
                                height: 48,
                                borderRadius: 24,
                                backgroundColor: theme.surface,
                                alignItems: 'center',
                                justifyContent: 'center',
                                overflow: 'hidden',
                                shadowColor: '#000',
                                shadowOpacity: 0.15,
                                shadowRadius: 6,
                                shadowOffset: { width: 0, height: 2 },
                                elevation: 4,
                            }}
                        >
                            <Image
                                source={{ uri: activeRule.ruleImg }}
                                style={{ width: 38, height: 38 }}
                                resizeMode="contain"
                            />
                        </View>
                    ) : (
                        <View style={{ width: 48, height: 48 }} />
                    )}
                    <View
                        style={{
                            marginTop: 6,
                            width: 52,
                            height: 52,
                            borderRadius: 26,
                            backgroundColor: theme.surface,
                            alignItems: 'center',
                            justifyContent: 'center',
                            shadowColor: '#000',
                            shadowOpacity: 0.15,
                            shadowRadius: 6,
                            shadowOffset: { width: 0, height: 2 },
                            elevation: 4,
                        }}
                    >
                        <Text style={{ fontSize: 16, fontWeight: '700', color: theme.textPrimary }}>
                            {currentSpeed}
                        </Text>
                        <Text style={{ fontSize: 9, color: theme.textSecondary }}>km/h</Text>
                    </View>
                </View>

                <View className="flex-row items-center">
                    {showReportHint && (
                        <Animated.View exiting={FadeOut.duration(300)}>
                        <TouchableOpacity
                            onPress={() => setShowReportHint(false)}
                            activeOpacity={0.7}
                            style={{
                                backgroundColor: theme.surface,
                                borderTopLeftRadius: 16,
                                borderBottomLeftRadius: 16,
                                paddingVertical: 8,
                                paddingHorizontal: 12,
                                paddingRight: 18,
                                marginRight: -14,
                                maxWidth: 150,
                                shadowColor: '#000',
                                shadowOpacity: 0.15,
                                shadowRadius: 6,
                                shadowOffset: { width: 0, height: 2 },
                                elevation: 4,
                            }}
                        >
                            <Text style={{ color: theme.textPrimary, fontSize: 13, fontWeight: '600' }}>
                                {t('share-what-you-see')}
                            </Text>
                        </TouchableOpacity>
                        </Animated.View>
                    )}
                    <TouchableOpacity
                        onPress={onReportPress}
                        style={{
                            width: 52,
                            height: 52,
                            borderRadius: 26,
                            backgroundColor: colors.primary.main,
                            alignItems: 'center',
                            justifyContent: 'center',
                            shadowColor: '#000',
                            shadowOpacity: 0.15,
                            shadowRadius: 6,
                            shadowOffset: { width: 0, height: 2 },
                            elevation: 4,
                        }}
                    >
                        <Ionicons name="warning-outline" size={24} color="#fff" />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Floats above the destination pill without taking layout space, so the
                speed / rule / report row stays put when the button appears. */}
            {showRecenterButton && onRecenter && (
                <View style={{ height: 0 }} pointerEvents="box-none">
                    <View
                        style={{ position: 'absolute', bottom: 10, left: 0, right: 0, alignItems: 'center' }}
                        pointerEvents="box-none"
                    >
                        <TouchableOpacity
                            activeOpacity={0.85}
                            onPress={onRecenter}
                            className="flex-row items-center rounded-full"
                            style={{
                                backgroundColor: theme.surface,
                                paddingVertical: 12,
                                paddingHorizontal: 22,
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.18,
                                shadowRadius: 6,
                                elevation: 5,
                            }}
                        >
                            <Ionicons name="navigate" size={20} color="#0F9D58" />
                            <Text
                                className="font-semibold ml-2"
                                style={{ color: theme.textPrimary, fontSize: 16 }}
                            >
                                Re-center
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {destination && (
                <View style={{ alignItems: 'center', marginBottom: 8 }}>
                    <View
                        style={{
                            backgroundColor: theme.surface,
                            borderRadius: 20,
                            paddingHorizontal: 16,
                            paddingVertical: 6,
                            shadowColor: '#000',
                            shadowOpacity: 0.2,
                            shadowRadius: 6,
                            shadowOffset: { width: 0, height: 2 },
                            elevation: 5,
                        }}
                    >
                        <Text style={{ color: NAV_GREEN, fontSize: 13, fontWeight: '600' }} numberOfLines={1}>
                            {destination}
                        </Text>
                    </View>
                </View>
            )}

            <View
                style={{
                    backgroundColor: theme.surface,
                    borderTopLeftRadius: 20,
                    borderTopRightRadius: 20,
                    paddingHorizontal: 20,
                    paddingTop: 16,
                    paddingBottom: insets.bottom + 16,
                }}
            >
                {totalRouteDistance ? (
                    <View style={{ height: 16, justifyContent: 'center', marginBottom: 14 }}>
                        <View
                            style={{
                                position: 'absolute',
                                left: 0,
                                right: 0,
                                height: 4,
                                borderRadius: 2,
                                backgroundColor: theme.border,
                            }}
                        />
                        <View
                            style={{
                                position: 'absolute',
                                left: 0,
                                width: `${routeProgress * 100}%`,
                                height: 4,
                                borderRadius: 2,
                                backgroundColor: NAV_GREEN,
                            }}
                        />
                        <Image
                            source={require('../../../../assets/images/progress-arrow.png')}
                            style={{
                                position: 'absolute',
                                left: `${routeProgress * 100}%`,
                                marginLeft: -7,
                                width: 16,
                                height: 16,
                            }}
                            resizeMode="contain"
                        />
                    </View>
                ) : null}

                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View
                        style={{
                            width: 48,
                            height: 48,
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        {activeRule ? (
                            <BlinkingRuleIcon uri={activeRule.ruleImg} size={44} />
                        ) : (
                            <>
                                <NavigationDirectionBackground
                                    width={48}
                                    height={48}
                                    style={{ position: 'absolute' }}
                                />
                                <Ionicons name={directionIcon} size={26} color={NAV_GREEN} />
                            </>
                        )}
                    </View>

                    <View style={{ flex: 1, alignItems: 'center' }}>
                        <Text style={{ fontSize: 18, fontWeight: '700', color: theme.textPrimary }}>
                            {remainingTime ? formatTime(remainingTime) : '-- min'}
                            {'  ·  '}
                            <Text style={{ fontSize: 16, fontWeight: '600' }}>ETA {getETA()}</Text>
                        </Text>
                        {destinationCoords && (
                            <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 2 }}>
                                {destinationCoords.lat.toFixed(5)}, {destinationCoords.lng.toFixed(5)}
                            </Text>
                        )}
                    </View>

                    <TouchableOpacity
                        onPress={onExitPress}
                        style={{
                            width: 48,
                            height: 48,
                            borderRadius: 24,
                            backgroundColor: theme.surface,
                            borderWidth: 2,
                            borderColor: NAV_GREEN,
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginLeft: 12,
                        }}
                    >
                        <Ionicons name="close" size={24} color={NAV_GREEN} />
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
};
