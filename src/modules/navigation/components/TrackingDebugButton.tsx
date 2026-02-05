import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { trackingTestUtils } from '../utils/tracking-test';
import { navigationTrackingService } from '../services/tracking.service';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LAST_SYNC_KEY = '@navigation_last_sync';

export const TrackingDebugButton = () => {
    const [output, setOutput] = useState<string>('');
    const [syncInfo, setSyncInfo] = useState<string>('');
    const [bgStatus, setBgStatus] = useState<string>('');

    useEffect(() => {
        updateSyncInfo();
        updateBackgroundStatus();
    }, []);

    const updateBackgroundStatus = async () => {
        try {
            const { backgroundSyncService } = await import('../services/background-sync.service');
            const isRegistered = await backgroundSyncService.isRegistered();
            const status = await backgroundSyncService.getStatus();

            console.log('[debugging] Background status check:', { isRegistered, status });
            setBgStatus(isRegistered ? 'BG: ON' : 'BG: OFF');
        } catch (error) {
            console.log('[debug] Background sync not available:', error);
            setBgStatus('BG: N/A');
        }
    };

    const updateSyncInfo = async () => {
        try {
            const lastSync = await AsyncStorage.getItem(LAST_SYNC_KEY);
            if (!lastSync) {
                setSyncInfo('Never synced');
                return;
            }

            const lastSyncTime = parseInt(lastSync, 10);
            const now = Date.now();
            const hoursSince = Math.floor((now - lastSyncTime) / (1000 * 60 * 60));
            const hoursUntil = Math.max(0, 24 - hoursSince);

            setSyncInfo(`Last: ${hoursSince}h ago\nNext: ${hoursUntil}h`);
        } catch (error) {
            setSyncInfo('Error');
        }
    };

    const handleViewData = async () => {
        await trackingTestUtils.viewStoredData();
        await updateSyncInfo();
        setOutput('Check console');
    };

    const handleAddTest = async () => {
        await trackingTestUtils.addTestData();
        await updateSyncInfo();
        setOutput('Test added!');
    };

    const handleForceSync = async () => {
        await trackingTestUtils.forceSyncNow();
        await updateSyncInfo();
        setOutput('Synced!');
    };

    const handleResetTimer = async () => {
        await trackingTestUtils.resetSyncTime();
        await updateSyncInfo();
        setOutput('Timer reset');
    };

    const handleTestAutoSync = async () => {
        await trackingTestUtils.resetSyncTime();
        const shouldSync = await navigationTrackingService.shouldSync();
        setOutput(shouldSync ? 'will sync' : 'will not sync');
        await updateSyncInfo();
    };

    const handleClear = async () => {
        await trackingTestUtils.clearAllData();
        await updateSyncInfo();
        setOutput('Cleared');
    };

    return (
        <View className="absolute bottom-20 right-4 bg-white rounded-lg shadow-lg p-3 max-w-[180px]">
            <Text className="font-bold mb-1 text-xs">Tracking Debug</Text>
            <Text className="text-[10px] text-gray-600">{syncInfo}</Text>
            <Text className="text-[10px] text-gray-600 mb-2">{bgStatus}</Text>

            <TouchableOpacity
                onPress={handleViewData}
                className="bg-orange-500 p-1.5 rounded mb-1"
            >
                <Text className="text-white text-[10px] text-center">View Data</Text>
            </TouchableOpacity>

            <TouchableOpacity
                onPress={handleAddTest}
                className="bg-orange-500 p-1.5 rounded mb-1"
            >
                <Text className="text-white text-[10px] text-center">Add Test</Text>
            </TouchableOpacity>

            <TouchableOpacity
                onPress={handleTestAutoSync}
                className="bg-orange-500 p-1.5 rounded mb-1"
            >
                <Text className="text-white text-[10px] text-center">Test Auto-Sync</Text>
            </TouchableOpacity>

            <TouchableOpacity
                onPress={handleForceSync}
                className="bg-orange-500 p-1.5 rounded mb-1"
            >
                <Text className="text-white text-[10px] text-center">Force Sync</Text>
            </TouchableOpacity>

            <TouchableOpacity
                onPress={handleResetTimer}
                className="bg-orange-500 p-1.5 rounded mb-1"
            >
                <Text className="text-white text-[10px] text-center">Reset Timer</Text>
            </TouchableOpacity>

            <TouchableOpacity
                onPress={handleClear}
                className="bg-orange-500 p-1.5 rounded"
            >
                <Text className="text-white text-[10px] text-center">Clear All</Text>
            </TouchableOpacity>

            {output ? (
                <Text className="text-[9px] mt-1 text-gray-700">{output}</Text>
            ) : null}
        </View>
    );
};
