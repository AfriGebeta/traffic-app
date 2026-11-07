import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Switch, Modal, TextInput } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { taxiService } from '../services/taxi.service';
import { colors } from '../../../shared/theme/colors';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { FONT_MEDIUM, RADIUS, RADIUS_SM, SectionLabel } from '../../campaigns/components/CampaignUi';
import { routeCacheService } from '../services/route-cache.service';
import { useRouteBuilder } from '../contexts/RouteBuilderContext';

interface RouteSegment {
    from: number;
    to: number;
    fromName: string;
    toName: string;
}

interface TimeWindow {
    startMinutes: number;
    endMinutes: number;
    isAvailable: boolean;
}

export default function SetAvailabilityScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams();
    const { colors: theme } = useTheme();
    const { endCollectorTracking, setIsCollecting } = useRouteBuilder();

    const [routeId, setRouteId] = useState<number | null>(null);
    const [routeName, setRouteName] = useState('');
    const [segments, setSegments] = useState<RouteSegment[]>([]);
    const [timeWindows, setTimeWindows] = useState<TimeWindow[]>([]);
    const [loading, setLoading] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [editingTime, setEditingTime] = useState<{ windowIndex: number; field: 'start' | 'end'; segmentIndex?: number } | null>(null);
    const [tempHour, setTempHour] = useState('');
    const [tempMinute, setTempMinute] = useState('');
    const [individualTimes, setIndividualTimes] = useState(false);

    useEffect(() => {
        if (params.routeId && params.routeName) {
            setRouteId(Number(params.routeId));
            setRouteName(params.routeName as string);

            if (params.segments) {
                const parsedSegments = JSON.parse(params.segments as string);
                setSegments(parsedSegments);
            }

            setTimeWindows([{
                startMinutes: 300, // 5 am
                endMinutes: 1320, // 10 pm
                isAvailable: true,
            }]);
        }
    }, [params.routeId, params.routeName, params.segments]);

    useEffect(() => {
        if (individualTimes && segments.length > 0) {
            const newTimeWindows = segments.map(() => ({
                startMinutes: 300,
                endMinutes: 1320,
                isAvailable: true,
            }));
            setTimeWindows(newTimeWindows);
        } else if (!individualTimes && segments.length > 0) {
            setTimeWindows([timeWindows[0] || {
                startMinutes: 300,
                endMinutes: 1320,
                isAvailable: true,
            }]);
        }
    }, [individualTimes]);

    const formatTime = (minutes: number): string => {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    };

    const openTimePicker = (windowIndex: number, field: 'start' | 'end', segmentIndex?: number) => {
        const window = timeWindows[windowIndex];
        const minutes = field === 'start' ? window.startMinutes : window.endMinutes;
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;

        setTempHour(hours.toString());
        setTempMinute(mins.toString());
        setEditingTime({ windowIndex, field, segmentIndex });
        setShowTimePicker(true);
    };

    const saveTime = () => {
        if (!editingTime) return;

        const hour = parseInt(tempHour) || 0;
        const minute = parseInt(tempMinute) || 0;

        if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
            Alert.alert(t('error'), t('invalid-time-format'));
            return;
        }

        const totalMinutes = hour * 60 + minute;
        updateTimeWindow(editingTime.windowIndex, editingTime.field === 'start' ? 'startMinutes' : 'endMinutes', totalMinutes);

        setShowTimePicker(false);
        setEditingTime(null);
    };

    const addTimeWindow = () => {
        setTimeWindows([
            ...timeWindows,
            {
                startMinutes: 300, // 5 am
                endMinutes: 1320, // 10 pm
                isAvailable: true,
            },
        ]);
    };

    const removeTimeWindow = (index: number) => {
        setTimeWindows(timeWindows.filter((_, i) => i !== index));
    };

    const updateTimeWindow = (index: number, field: keyof TimeWindow, value: any) => {
        const updated = [...timeWindows];
        updated[index] = { ...updated[index], [field]: value };
        setTimeWindows(updated);
    };

    const handleSubmit = async () => {
        if (!routeId) {
            Alert.alert(t('error'), t('route-id-not-found'));
            return;
        }

        if (timeWindows.length === 0) {
            Alert.alert(t('error'), t('please-add-at-least-one-time-window'));
            return;
        }

        for (const window of timeWindows) {
            if (window.startMinutes >= window.endMinutes) {
                Alert.alert(t('error'), t('start-time-must-be-before-end-time'));
                return;
            }
        }

        setLoading(true);
        try {
            console.log(`[Availability] Creating windows for route ${routeId}: ${routeName}`);

            if (individualTimes && segments.length > 0) {
               
                for (let i = 0; i < segments.length; i++) {
                    const window = timeWindows[i];
                    await taxiService.createAvailabilityWindow({
                        routeId: routeId,
                        dayOfWeek: null,
                        startMinutes: window.startMinutes,
                        endMinutes: window.endMinutes,
                        isAvailable: window.isAvailable,
                    });
                }
            } else {
                
                const window = timeWindows[0];
                await taxiService.createAvailabilityWindow({
                    routeId: routeId,
                    dayOfWeek: null,
                    startMinutes: window.startMinutes,
                    endMinutes: window.endMinutes,
                    isAvailable: window.isAvailable,
                });
            }

            Alert.alert(t('success'), t('availability-windows-created-successfully'), [
                {
                    text: t('ok'),
                    onPress: async () => {
                        console.log('[SetAvailability] Ending collector tracking...');
                        await endCollectorTracking();
                        setIsCollecting(false);

                        await routeCacheService.clearRouteCache();

                        router.back();
                        router.back();
                        router.back();
                    },
                },
            ]);
        } catch (error: any) {
            console.error('Availability window creation error:', error);
            Alert.alert(
                t('error'),
                error.response?.data?.message || error.message || t('failed-to-create-availability-window')
            );
        } finally {
            setLoading(false);
        }
    };

    if (!routeId) {
        return null;
    }

    return (
        <View className="flex-1" style={{ paddingTop: insets.top, backgroundColor: theme.background }}>
            <View className="px-6 pt-3 pb-2">
                <TouchableOpacity onPress={() => router.back()} className="self-start p-1 -ml-1" activeOpacity={0.7} hitSlop={8}>
                    <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
                </TouchableOpacity>
                <Text className="mt-3" style={{ color: theme.textPrimary, fontSize: 26, lineHeight: 32, letterSpacing: -0.4 }}>
                    {t('set-availability')}
                </Text>
                <Text className="text-sm mt-1" style={{ color: theme.textSecondary }}>
                    {t('set-operating-hours-for-all-routes')}
                </Text>
            </View>

            <ScrollView className="flex-1 px-6" contentContainerStyle={{ paddingTop: 16, paddingBottom: insets.bottom + 20 }}>
                <View className="mb-4">
                    <Text className="mb-1" style={{ color: theme.textPrimary, fontFamily: FONT_MEDIUM, fontSize: 17 }}>
                        {routeName}
                    </Text>
                    <Text className="text-xs mb-4" style={{ color: theme.textSecondary }}>
                        {individualTimes
                            ? t('set-individual-times-for-each-route')
                            : segments.length > 0
                                ? `${t('these-hours-will-apply-to-all-edges')} (${segments.length} ${t('edges')})`
                                : t('set-operating-hours-for-route')
                        }
                    </Text>

                    {segments.length > 0 && (
                        <View className="mb-4 p-4" style={{ borderRadius: RADIUS, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface }}>
                            <View className="flex-row items-center justify-between">
                                <View className="flex-1 mr-3">
                                    <Text className="text-sm mb-0.5" style={{ color: theme.textPrimary, fontFamily: FONT_MEDIUM }}>
                                        {t('individual-times-per-route')}
                                    </Text>
                                    <Text className="text-xs" style={{ color: theme.textSecondary }}>
                                        {individualTimes
                                            ? t('each-route-has-its-own-time')
                                            : t('all-routes-share-same-time')
                                        }
                                    </Text>
                                </View>
                                <Switch
                                    value={individualTimes}
                                    onValueChange={setIndividualTimes}
                                    trackColor={{ false: colors.gray[200], true: colors.primary.light }}
                                    thumbColor={individualTimes ? colors.primary.main : colors.gray[100]}
                                />
                            </View>
                        </View>
                    )}

                    {!individualTimes && segments.length > 0 && (
                        <View className="mb-4 p-3" style={{ borderRadius: RADIUS, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }}>
                            <SectionLabel style={{ marginBottom: 6 }}>{t('affected-routes')}</SectionLabel>
                            {segments.map((segment, index) => (
                                <Text key={index} className="text-sm leading-6" style={{ color: theme.textSecondary }}>
                                    • {segment.fromName} → {segment.toName}
                                </Text>
                            ))}
                        </View>
                    )}

                    {individualTimes && segments.length > 0 ? (
                        segments.map((segment, segmentIndex) => (
                            <View key={segmentIndex} className="mb-4 p-4" style={{ borderRadius: RADIUS, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }}>
                                <Text className="text-sm mb-3" style={{ color: theme.textPrimary, fontFamily: FONT_MEDIUM }}>
                                    {segment.fromName} → {segment.toName}
                                </Text>

                                <View className="flex-row items-center justify-between mb-4">
                                    <View className="flex-1 mr-2">
                                        <Text className="text-xs mb-1.5" style={{ color: theme.textSecondary }}>{t('start-time')}</Text>
                                        <TouchableOpacity
                                            className="p-3"
                                            style={{ borderRadius: RADIUS_SM, backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border }}
                                            onPress={() => openTimePicker(segmentIndex, 'start', segmentIndex)}
                                        >
                                            <Text className="text-center" style={{ color: theme.textPrimary, fontSize: 18, fontVariant: ['tabular-nums'] }}>
                                                {formatTime(timeWindows[segmentIndex]?.startMinutes || 300)}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                    <View className="flex-1 ml-2">
                                        <Text className="text-xs mb-1.5" style={{ color: theme.textSecondary }}>{t('end-time')}</Text>
                                        <TouchableOpacity
                                            className="p-3"
                                            style={{ borderRadius: RADIUS_SM, backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border }}
                                            onPress={() => openTimePicker(segmentIndex, 'end', segmentIndex)}
                                        >
                                            <Text className="text-center" style={{ color: theme.textPrimary, fontSize: 18, fontVariant: ['tabular-nums'] }}>
                                                {formatTime(timeWindows[segmentIndex]?.endMinutes || 1320)}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                <View className="flex-row items-center justify-between pt-3" style={{ borderTopWidth: 1, borderTopColor: theme.border }}>
                                    <Text className="text-sm" style={{ color: theme.textPrimary }}>{t('is-available')}</Text>
                                    <Switch
                                        value={timeWindows[segmentIndex]?.isAvailable ?? true}
                                        onValueChange={(value) => updateTimeWindow(segmentIndex, 'isAvailable', value)}
                                        trackColor={{ false: colors.gray[200], true: colors.primary.light }}
                                        thumbColor={timeWindows[segmentIndex]?.isAvailable ? colors.primary.main : colors.gray[100]}
                                    />
                                </View>
                            </View>
                        ))
                    ) : (
                        timeWindows.map((window, index) => (
                            <View key={index} className="mb-4 p-4" style={{ borderRadius: RADIUS, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }}>
                                <View className="flex-row items-center justify-between mb-4">
                                    <Text className="text-sm" style={{ color: theme.textPrimary, fontFamily: FONT_MEDIUM }}>
                                        {t('operating-hours')}
                                    </Text>
                                    {timeWindows.length > 1 && (
                                        <TouchableOpacity onPress={() => removeTimeWindow(index)}>
                                            <Ionicons name="trash-outline" size={18} color={theme.error} />
                                        </TouchableOpacity>
                                    )}
                                </View>

                                <View className="flex-row items-center justify-between mb-4">
                                    <View className="flex-1 mr-2">
                                        <Text className="text-xs mb-1.5" style={{ color: theme.textSecondary }}>{t('start-time')}</Text>
                                        <TouchableOpacity
                                            className="p-3"
                                            style={{ borderRadius: RADIUS_SM, backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border }}
                                            onPress={() => openTimePicker(index, 'start')}
                                        >
                                            <Text className="text-center" style={{ color: theme.textPrimary, fontSize: 18, fontVariant: ['tabular-nums'] }}>
                                                {formatTime(window.startMinutes)}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                    <View className="flex-1 ml-2">
                                        <Text className="text-xs mb-1.5" style={{ color: theme.textSecondary }}>{t('end-time')}</Text>
                                        <TouchableOpacity
                                            className="p-3"
                                            style={{ borderRadius: RADIUS_SM, backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border }}
                                            onPress={() => openTimePicker(index, 'end')}
                                        >
                                            <Text className="text-center" style={{ color: theme.textPrimary, fontSize: 18, fontVariant: ['tabular-nums'] }}>
                                                {formatTime(window.endMinutes)}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                <View className="flex-row items-center justify-between pt-3" style={{ borderTopWidth: 1, borderTopColor: theme.border }}>
                                    <Text className="text-sm" style={{ color: theme.textPrimary }}>{t('is-available')}</Text>
                                    <Switch
                                        value={window.isAvailable}
                                        onValueChange={(value) => updateTimeWindow(index, 'isAvailable', value)}
                                        trackColor={{ false: colors.gray[200], true: colors.primary.light }}
                                        thumbColor={window.isAvailable ? colors.primary.main : colors.gray[100]}
                                    />
                                </View>
                            </View>
                        ))
                    )}

                    {!individualTimes && (
                        <TouchableOpacity
                            className="mb-4 flex-row items-center justify-center"
                            style={{ height: 46, borderRadius: RADIUS_SM, borderWidth: 1, borderStyle: 'dashed', borderColor: theme.border, backgroundColor: theme.surface }}
                            onPress={addTimeWindow}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="add-circle-outline" size={18} color={theme.primary} />
                            <Text className="text-sm ml-2" style={{ color: theme.textPrimary, fontFamily: FONT_MEDIUM }}>{t('add-time-window')}</Text>
                        </TouchableOpacity>
                    )}

                    <View className="flex-row space-x-2">
                        <TouchableOpacity
                            className="flex-1 items-center justify-center"
                            onPress={handleSubmit}
                            disabled={loading}
                            activeOpacity={0.7}
                            style={{ height: 48, borderRadius: RADIUS_SM, backgroundColor: loading ? theme.border : theme.primary }}
                        >
                            {loading ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <Text className="text-center" style={{ color: '#fff', fontFamily: FONT_MEDIUM, fontSize: 16 }}>
                                    {individualTimes ? t('submit') : t('apply-to-all-routes')}
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>

            <Modal
                visible={showTimePicker}
                transparent
                animationType="fade"
                onRequestClose={() => setShowTimePicker(false)}
            >
                <View className="flex-1 bg-black/50 justify-center items-center">
                    <View className="p-6 w-80 mx-4" style={{ borderRadius: RADIUS, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }}>
                        <Text className="mb-4" style={{ color: theme.textPrimary, fontFamily: FONT_MEDIUM, fontSize: 17 }}>
                            {editingTime?.field === 'start' ? t('set-start-time') : t('set-end-time')}
                        </Text>

                        <View className="flex-row items-center justify-center mb-6">
                            <View className="flex-1 mr-2">
                                <Text className="text-xs mb-1.5 text-center" style={{ color: theme.textSecondary }}>{t('hour')}</Text>
                                <TextInput
                                    className="px-4 py-3 text-center"
                                    style={{ borderRadius: RADIUS_SM, fontSize: 22, fontVariant: ['tabular-nums'], backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border, color: theme.textPrimary }}
                                    placeholderTextColor={theme.textSecondary}
                                    value={tempHour}
                                    onChangeText={setTempHour}
                                    keyboardType="number-pad"
                                    maxLength={2}
                                    placeholder="00"
                                />
                            </View>
                            <Text className="mx-2" style={{ color: theme.textSecondary, fontSize: 26, marginTop: 18 }}>:</Text>
                            <View className="flex-1 ml-2">
                                <Text className="text-xs mb-1.5 text-center" style={{ color: theme.textSecondary }}>{t('minute')}</Text>
                                <TextInput
                                    className="px-4 py-3 text-center"
                                    style={{ borderRadius: RADIUS_SM, fontSize: 22, fontVariant: ['tabular-nums'], backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border, color: theme.textPrimary }}
                                    placeholderTextColor={theme.textSecondary}
                                    value={tempMinute}
                                    onChangeText={setTempMinute}
                                    keyboardType="number-pad"
                                    maxLength={2}
                                    placeholder="00"
                                />
                            </View>
                        </View>

                        <Text className="text-xs text-center mb-4" style={{ color: theme.textSecondary }}>
                            {t('format-24-hour')}
                        </Text>

                        <View className="flex-row space-x-2">
                            <TouchableOpacity
                                className="flex-1 mr-2 items-center justify-center"
                                style={{ height: 44, borderRadius: RADIUS_SM, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.background }}
                                onPress={() => setShowTimePicker(false)}
                            >
                                <Text className="text-center text-sm" style={{ color: theme.textPrimary, fontFamily: FONT_MEDIUM }}>{t('cancel')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                className="flex-1 ml-2 items-center justify-center"
                                style={{ height: 44, borderRadius: RADIUS_SM, backgroundColor: theme.primary }}
                                onPress={saveTime}
                            >
                                <Text className="text-center text-sm" style={{ color: '#fff', fontFamily: FONT_MEDIUM }}>{t('save')}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
