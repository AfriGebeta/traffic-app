import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { navigationTrackingService } from './tracking.service';

const BACKGROUND_SYNC_TASK = 'navigation-background-sync';

TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
    try {
        console.log('bg: Running background sync task...');
        await navigationTrackingService.checkAndSync();

        console.log('bg: Background sync completed');
        return BackgroundFetch.BackgroundFetchResult.NewData;
    } catch (error) {
        console.error('bg: Background sync failed:', error);
        return BackgroundFetch.BackgroundFetchResult.Failed;
    }
});

export const backgroundSyncService = {

    async register(): Promise<void> {
        try {
            const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);

            if (isRegistered) {
                console.log('[Bg] Task already registered');
                return;
            }

            await BackgroundFetch.registerTaskAsync(BACKGROUND_SYNC_TASK, {
                minimumInterval: 60 * 15,
                stopOnTerminate: false,
                startOnBoot: true,
            });

            console.log('bg: background sync registered successfully (15 min intervals as fallback)');
        } catch (error) {
            console.error('[bg]: failed to register background sync:', error);
        }
    },

    async unregister(): Promise<void> {
        try {
            await BackgroundFetch.unregisterTaskAsync(BACKGROUND_SYNC_TASK);
            console.log('bg: Background sync unregistered');
        } catch (error) {
            console.error('bg: Failed to unregister background sync:', error);
        }
    },

    async isRegistered(): Promise<boolean> {
        try {
            return await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);
        } catch (error) {
            console.error('bg:Failed to check registration:', error);
            return false;
        }
    },

    async getStatus(): Promise<BackgroundFetch.BackgroundFetchStatus> {
        try {
            const status = await BackgroundFetch.getStatusAsync();
            return status ?? BackgroundFetch.BackgroundFetchStatus.Denied;
        } catch (error) {
            console.error('back: Failed to get status:', error);
            return BackgroundFetch.BackgroundFetchStatus.Denied;
        }
    },
};
