import { navigationTrackingService } from '../services/tracking.service';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@navigation_tracking';
const LAST_SYNC_KEY = '@navigation_last_sync';

export const trackingTestUtils = {

    async viewStoredData() {
        try {
            const data = await AsyncStorage.getItem(STORAGE_KEY);
            const lastSync = await AsyncStorage.getItem(LAST_SYNC_KEY);

            console.log('Stored Navigation Data-------------------------');
            console.log(data ? JSON.parse(data) : 'No data');
            console.log('\nlast sync time---');
            console.log(lastSync ? new Date(parseInt(lastSync)).toISOString() : 'Never synced');
        } catch (error) {
            console.error('Error viewing data:', error);
        }
    },

    async clearAllData() {
        try {
            await AsyncStorage.removeItem(STORAGE_KEY);
            await AsyncStorage.removeItem(LAST_SYNC_KEY);
            console.log('All tracking data cleared');
        } catch (error) {
            console.error('Error clearing data:', error);
        }
    },

    async forceSyncNow() {
        try {
            const success = await navigationTrackingService.syncNavigationHistory();
            console.log(success ? 'Sync successful' : 'Sync failed');
        } catch (error) {
            console.error('Error syncing:', error);
        }
    },

    async addTestData() {
        const navId = `nav_test_${Date.now()}`;

        for (let i = 0; i < 6; i++) {
            await navigationTrackingService.addNavigationPoint(
                navId,
                9.0223 + (i * 0.0001), 
                38.7463 + (i * 0.0001)
            );

            if (i < 5) {
                await new Promise(resolve => setTimeout(resolve, 100)); 
            }
        }

        console.log(`Added test navigation: ${navId}`);
    },

    async resetSyncTime() {
        try {
            const yesterday = Date.now() - (25 * 60 * 60 * 1000);
            await AsyncStorage.setItem(LAST_SYNC_KEY, yesterday.toString());
            console.log('Last sync time reset to 25 hours ago');
        } catch (error) {
            console.error('Error resetting sync time:', error);
        }
    },
};
