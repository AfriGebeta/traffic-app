import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeepAwake } from 'expo-keep-awake';
import { colors } from '../../../shared/theme/colors';

const NAV_GREEN = '#1E5438';

interface ActiveRule {
    ruleId: string;
    ruleName: string;
    ruleImg: string;
}

interface NavigationOverlayProps {
    remainingTime?: number;
    remainingDistance?: number;
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
}

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
}) => {
    useKeepAwake();
    const insets = useSafeAreaInsets();

    const getETA = () => {
        if (!remainingTime) return '--:--';
        const eta = new Date(Date.now() + remainingTime * 1000);
        return eta.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    };

    return (
        <View className="absolute left-0 right-0 bottom-0">
            {isRecalculating && (
                <View className="mx-4 mb-2 bg-orange-50 border border-orange-200 rounded-xl px-3 py-2">
                    <Text className="text-orange-600 text-sm font-semibold text-center">
                        Recalculating route...
                    </Text>
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

            {showRecenterButton && onRecenter && (
                <TouchableOpacity
                    className="mx-4 mb-2 border rounded-2xl py-2 flex-row items-center justify-center"
                    style={{ backgroundColor: 'rgba(249, 115, 22, 0.1)', borderColor: '#FFA500' }}
                    onPress={onRecenter}
                >
                    <Text className="text-orange-600 text-sm font-bold">Re-center</Text>
                </TouchableOpacity>
            )}

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
                                backgroundColor: '#fff',
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
                            backgroundColor: '#fff',
                            alignItems: 'center',
                            justifyContent: 'center',
                            shadowColor: '#000',
                            shadowOpacity: 0.15,
                            shadowRadius: 6,
                            shadowOffset: { width: 0, height: 2 },
                            elevation: 4,
                        }}
                    >
                        <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827' }}>
                            {currentSpeed}
                        </Text>
                        <Text style={{ fontSize: 9, color: '#6B7280' }}>km/h</Text>
                    </View>
                </View>

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

            {destination && (
                <View style={{ alignItems: 'center', marginBottom: 8 }}>
                    <View
                        style={{
                            backgroundColor: '#fff',
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
                    backgroundColor: '#fff',
                    borderTopLeftRadius: 20,
                    borderTopRightRadius: 20,
                    paddingHorizontal: 20,
                    paddingTop: 16,
                    paddingBottom: insets.bottom + 16,
                    flexDirection: 'row',
                    alignItems: 'center',
                }}
            >
                <View style={{ flex: 1, alignItems: 'center', paddingLeft: 60 }}>
                    <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}>
                        {remainingTime ? formatTime(remainingTime) : '-- min'}
                        {'  ·  '}
                        <Text style={{ fontSize: 16, fontWeight: '600' }}>ETA {getETA()}</Text>
                    </Text>
                    {destinationCoords && (
                        <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
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
                        backgroundColor: '#fff',
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
    );
};
