import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Switch, Modal, TextInput } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { taxiService } from '../services/taxi.service';
import { colors } from '../../../shared/theme/colors';

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
    const [selectedEdgeIndex, setSelectedEdgeIndex] = useState(0);
    const [timeWindows, setTimeWindows] = useState<TimeWindow[]>([]);
    const [loading, setLoading] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [editingTime, setEditingTime] = useState<{ windowIndex: number; field: 'start' | 'end' } | null>(null);
    const [tempHour, setTempHour] = useState('');
    const [tempMinute, setTempMinute] = useState('');

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

    const formatTime = (minutes: number): string => {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    };

    const openTimePicker = (windowIndex: number, field: 'start' | 'end') => {
        const window = timeWindows[windowIndex];
        const minutes = field === 'start' ? window.startMinutes : window.endMinutes;
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;

        setTempHour(hours.toString());
        setTempMinute(mins.toString());
        setEditingTime({ windowIndex, field });
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
            const currentEdge = edges[selectedEdgeIndex];

            for (const window of timeWindows) {
                await taxiService.createAvailabilityWindow({
                    edgeStartId: currentEdge.startNodeId,
                    edgeEndId: currentEdge.endNodeId,
                    dayOfWeek: null, 
                    startMinutes: window.startMinutes,
                    endMinutes: window.endMinutes,
                    isAvailable: window.isAvailable,
                });
            }

            if (selectedEdgeIndex < edges.length - 1) {
                setSelectedEdgeIndex(selectedEdgeIndex + 1);
                setTimeWindows([{
                    startMinutes: 300, 
                    endMinutes: 1320, 
                    isAvailable: true,
                }]);
            } else {
                Alert.alert(t('success'), t('availability-windows-created-successfully'), [
                    {
                        text: t('ok'),
                        onPress: () => {
                            router.back();
                            router.back();
                            router.back();
                        },
                    },
                ]);
            }
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

    const skipEdge = () => {
        if (selectedEdgeIndex < edges.length - 1) {
            setSelectedEdgeIndex(selectedEdgeIndex + 1);
            setTimeWindows([{
                startMinutes: 300,
                endMinutes: 1320,
                isAvailable: true,
            }]);
        } else {
            router.back();
            router.back();
            router.back();
        }
    };

    if (edges.length === 0) {
        return null;
    }

    const currentEdge = edges[selectedEdgeIndex];

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
                    {t('edge')} {selectedEdgeIndex + 1} {t('of')} {edges.length}
                </Text>
            </View>

            <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
                <View className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-4">
                    <Text className="text-lg font-bold text-gray-900 mb-2">
                        {currentEdge.fromName} → {currentEdge.toName}
                    </Text>
                    <Text className="text-gray-600 text-sm mb-4">
                        {t('set-operating-hours-for-this-route')}
                    </Text>

                    {timeWindows.map((window, index) => (
                        <View key={index} className="mb-6 p-4 bg-gray-50 rounded-xl">
                            <View className="flex-row items-center justify-between mb-4">
                                <Text className="text-gray-900 font-semibold">
                                    {t('time-window')} {index + 1}
                                </Text>
                                {timeWindows.length > 1 && (
                                    <TouchableOpacity onPress={() => removeTimeWindow(index)}>
                                        <Ionicons name="trash" size={20} color="#EF4444" />
                                    </TouchableOpacity>
                                )}
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
                    ))}

                    <TouchableOpacity
                        className="bg-gray-200 py-3 rounded-xl mb-4 flex-row items-center justify-center"
                        onPress={addTimeWindow}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="add-circle" size={24} color={colors.primary.main} />
                        <Text className="text-gray-700 font-semibold ml-2">{t('add-time-window')}</Text>
                    </TouchableOpacity>

                    <View className="flex-row space-x-2">
                        <TouchableOpacity
                            className="flex-1 bg-gray-400 py-4 rounded-xl mr-2"
                            onPress={skipEdge}
                            activeOpacity={0.7}
                        >
                            <Text className="text-white text-center font-bold text-lg">{t('skip')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            className={`flex-1 py-4 rounded-xl ml-2 ${loading ? 'bg-gray-400' : 'bg-primary'}`}
                            onPress={handleSubmit}
                            disabled={loading}
                            activeOpacity={0.7}
                            style={!loading ? { backgroundColor: colors.primary.main } : undefined}
                        >
                            {loading ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <Text className="text-white text-center font-bold text-lg">
                                    {selectedEdgeIndex < edges.length - 1 ? t('next') : t('finish')}
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
