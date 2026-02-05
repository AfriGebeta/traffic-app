import { useEffect } from 'react';


export const useBackgroundSync = () => {
    useEffect(() => {
        const registerBackgroundSync = async () => {
            try {
                const { backgroundSyncService } = await import('../services/background-sync.service');

                await backgroundSyncService.register();

                const status = await backgroundSyncService.getStatus();
                const isRegistered = await backgroundSyncService.isRegistered();

                console.log('[Bg] Sync status:', {
                    registered: isRegistered,
                    status: getStatusName(status),
                });
            } catch (error) {
                console.log('[bg] bg sync not available');
                console.log('[bg] error:', error);
            }
        };

        registerBackgroundSync();
    }, []);
};

function getStatusName(status: number): string {
    const statusMap: Record<number, string> = {
        1: 'Available',
        2: 'Denied',
        3: 'Restricted',
    };
    return statusMap[status] || 'Unknown';
}
