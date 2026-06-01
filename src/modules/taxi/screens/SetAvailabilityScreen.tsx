import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Switch, Modal, TextInput } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { taxiService } from '../services/taxi.service';
import { colors } from '../../../shared/theme/colors';
import { routeCacheService } from '../services/route-cache.service';

interface EdgeInfo {
    startNodeId: number;
    endNodeId: number;
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

    const [edges, setEdges] = useState<EdgeInfo[]>([]);
    const [timeWindows, setTimeWindows] = useState<TimeWindow[]>([]);
    const [loading, setLoading] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [editingTime, setEditingTime] = useState<{ windowIndex: number; field: 'start' | 'end'; edgeIndex?: number } | null>(null);
    const [tempHour, setTempHour] = useState('');
    const [tempMinute, setTempMinute] = useState('');
    const [individualTimes, setIndividualTimes] = useState(false);

    useEffect(() => {
        if (params.edges) {
            const parsedEdges = JSON.parse(params.edges as string);
            setEdges(parsedEdges);

            setTimeWindows([{
                startMinutes: 300, // 5 am
                endMinutes: 1320, // 10 pm
                isAvailable: true,
            }]);
        }
    }, [params.edges]);

    useEffect(() => {
        if (individualTimes && edges.length > 0) {
            const newTimeWindows = edges.map(() => ({
                startMinutes: 300,
                endMinutes: 1320,
                isAvailable: true,
            }));
            setTimeWindows(newTimeWindows);
        } else if (!individualTimes && edges.length > 0) {

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

    const openTimePicker = (windowIndex: number, field: 'start' | 'end', edgeIndex?: number) => {
        const window = timeWindows[windowIndex];
        const minutes = field === 'start' ? window.startMinutes : window.endMinutes;
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;

        setTempHour(hours.toString());
        setTempMinute(mins.toString());
        setEditingTime({ windowIndex, field, edgeIndex });
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
            console.log(`[Availability] Creating windows for ${edges.length} edges`);

            if (individualTimes) {
                for (let i = 0; i < edges.length; i++) {
                    const edge = edges[i];
                    const window = timeWindows[i];
                    await taxiService.createAvailabilityWindow({
                        edgeStartId: edge.startNodeId,
                        edgeEndId: edge.endNodeId,
                        dayOfWeek: null,
                        startMinutes: window.startMinutes,
                        endMinutes: window.endMinutes,
                        isAvailable: window.isAvailable,
                    });

                }
            } else {
                const window = timeWindows[0];
                for (const edge of edges) {
                    await taxiService.createAvailabilityWindow({
                        edgeStartId: edge.startNodeId,
                        edgeEndId: edge.endNodeId,
                        dayOfWeek: null,
                        startMinutes: window.startMinutes,
                        endMinutes: window.endMinutes,
                        isAvailable: window.isAvailable,
                    });

                }
            }

            Alert.alert(t('success'), t('availability-windows-created-successfully'), [
                {
                    text: t('ok'),
                    onPress: async () => {
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

    if (edges.length === 0) {
        return null;
    }

    return (
        <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
            <View className="px-4 py-6 border-b border-gray-50">
                <View className="flex-row items-center mb-2">
                    <TouchableOpacity onPress={() => router.back()} className="mr-4" activeOpacity={0.7}>
                        <Ionicons name="arrow-back" size={28} color={colors.primary.main} />
                    </TouchableOpacity>
                    <Text className="text-2xl font-bold text-gray-900">{t('set-availability')}</Text>
                </View>
                <Text className="text-gray-600 mt-2">
                    {t('set-operating-hours-for-all-routes')}
                </Text>
            </View>

            <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
                <View className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-4">
                    <Text className="text-lg font-bold text-gray-900 mb-2">
                        {params.routeName}
                    </Text>
                    <Text className="text-gray-600 text-sm mb-4">
                        {individualTimes
                            ? t('set-individual-times-for-each-route')
                            : `${t('these-hours-will-apply-to-all-edges')} (${edges.length} ${t('edges')})`
                        }
                    </Text>

                    <View className="mb-4 p-4 bg-orange-50 border border-orange-200 rounded-xl">
                        <View className="flex-row items-center justify-between">
                            <View className="flex-1 mr-3">
                                <Text className="text-gray-900 font-semibold mb-1">
                                    {t('individual-times-per-route')}
                                </Text>
                                <Text className="text-gray-600 text-xs">
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

                    {!individualTimes && (
                        <View className="mb-4 p-3 bg-gray-50 rounded-xl">
                            <Text className="text-gray-700 font-semibold mb-2">{t('affected-routes')}:</Text>
                            {edges.map((edge, index) => (
                                <Text key={index} className="text-gray-600 text-sm">
                                    • {edge.fromName} → {edge.toName}
                                </Text>
                            ))}
                        </View>
                    )}

                    {individualTimes ? (
                        edges.map((edge, edgeIndex) => (
                            <View key={edgeIndex} className="mb-6 p-4 bg-gray-50 rounded-xl border-2 border-gray-200">
                                <Text className="text-gray-900 font-bold mb-3">
                                    {edge.fromName} → {edge.toName}
                                </Text>

                                <View className="flex-row items-center justify-between mb-4">
                                    <View className="flex-1 mr-2">
                                        <Text className="text-gray-700 font-medium mb-2">{t('start-time')}</Text>
                                        <TouchableOpacity
                                            className="bg-white border border-gray-300 rounded-lg p-3"
                                            onPress={() => openTimePicker(edgeIndex, 'start', edgeIndex)}
                                        >
                                            <Text className="text-gray-900 text-center font-mono text-lg">
                                                {formatTime(timeWindows[edgeIndex]?.startMinutes || 300)}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                    <View className="flex-1 ml-2">
                                        <Text className="text-gray-700 font-medium mb-2">{t('end-time')}</Text>
                                        <TouchableOpacity
                                            className="bg-white border border-gray-300 rounded-lg p-3"
                                            onPress={() => openTimePicker(edgeIndex, 'end', edgeIndex)}
                                        >
                                            <Text className="text-gray-900 text-center font-mono text-lg">
                                                {formatTime(timeWindows[edgeIndex]?.endMinutes || 1320)}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                <View className="flex-row items-center justify-between bg-white p-3 rounded-lg">
                                    <Text className="text-gray-700 font-medium">{t('is-available')}</Text>
                                    <Switch
                                        value={timeWindows[edgeIndex]?.isAvailable ?? true}
                                        onValueChange={(value) => updateTimeWindow(edgeIndex, 'isAvailable', value)}
                                        trackColor={{ false: colors.gray[200], true: colors.primary.light }}
                                        thumbColor={timeWindows[edgeIndex]?.isAvailable ? colors.primary.main : colors.gray[100]}
                                    />
                                </View>
                            </View>
                        ))
                    ) : (
                        timeWindows.map((window, index) => (
                            <View key={index} className="mb-6 p-4 bg-gray-50 rounded-xl">
                                <View className="flex-row items-center justify-between mb-4">
                                    <Text className="text-gray-900 font-semibold">
                                        {t('operating-hours')}
                                    </Text>
                                </View>

                                <View className="flex-row items-center justify-between mb-4">
                                    <View className="flex-1 mr-2">
                                        <Text className="text-gray-700 font-medium mb-2">{t('start-time')}</Text>
                                        <TouchableOpacity
                                            className="bg-white border border-gray-300 rounded-lg p-3"
                                            onPress={() => openTimePicker(index, 'start')}
                                        >
                                            <Text className="text-gray-900 text-center font-mono text-lg">
                                                {formatTime(window.startMinutes)}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                    <View className="flex-1 ml-2">
                                        <Text className="text-gray-700 font-medium mb-2">{t('end-time')}</Text>
                                        <TouchableOpacity
                                            className="bg-white border border-gray-300 rounded-lg p-3"
                                            onPress={() => openTimePicker(index, 'end')}
                                        >
                                            <Text className="text-gray-900 text-center font-mono text-lg">
                                                {formatTime(window.endMinutes)}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                <View className="flex-row items-center justify-between bg-white p-3 rounded-lg">
                                    <Text className="text-gray-700 font-medium">{t('is-available')}</Text>
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

                    <View className="flex-row space-x-2">
                        <TouchableOpacity
                            className={`flex-1 py-4 rounded-xl ${loading ? 'bg-gray-400' : 'bg-primary'}`}
                            onPress={handleSubmit}
                            disabled={loading}
                            activeOpacity={0.7}
                            style={!loading ? { backgroundColor: colors.primary.main } : undefined}
                        >
                            {loading ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <Text className="text-white text-center font-bold text-lg">
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
                    <View className="bg-white rounded-2xl p-6 w-80 mx-4">
                        <Text className="text-xl font-bold text-gray-900 mb-4">
                            {editingTime?.field === 'start' ? t('set-start-time') : t('set-end-time')}
                        </Text>

                        <View className="flex-row items-center justify-center mb-6">
                            <View className="flex-1 mr-2">
                                <Text className="text-gray-700 font-medium mb-2 text-center">{t('hour')}</Text>
                                <TextInput
                                    className="bg-gray-50 border border-gray-300 rounded-lg px-4 py-3 text-center text-xl font-mono"
                                    value={tempHour}
                                    onChangeText={setTempHour}
                                    keyboardType="number-pad"
                                    maxLength={2}
                                    placeholder="00"
                                />
                            </View>
                            <Text className="text-3xl font-bold text-gray-400 mx-2">:</Text>
                            <View className="flex-1 ml-2">
                                <Text className="text-gray-700 font-medium mb-2 text-center">{t('minute')}</Text>
                                <TextInput
                                    className="bg-gray-50 border border-gray-300 rounded-lg px-4 py-3 text-center text-xl font-mono"
                                    value={tempMinute}
                                    onChangeText={setTempMinute}
                                    keyboardType="number-pad"
                                    maxLength={2}
                                    placeholder="00"
                                />
                            </View>
                        </View>

                        <Text className="text-gray-500 text-sm text-center mb-4">
                            {t('format-24-hour')}
                        </Text>

                        <View className="flex-row space-x-2">
                            <TouchableOpacity
                                className="flex-1 bg-gray-200 py-3 rounded-xl mr-2"
                                onPress={() => setShowTimePicker(false)}
                            >
                                <Text className="text-gray-700 text-center font-semibold">{t('cancel')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                className="flex-1 py-3 rounded-xl ml-2"
                                style={{ backgroundColor: colors.primary.main }}
                                onPress={saveTime}
                            >
                                <Text className="text-white text-center font-semibold">{t('save')}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
