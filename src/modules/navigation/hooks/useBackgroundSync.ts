import { useEffect } from 'react';


export const useBackgroundSync = () => {
    useEffect(() => {
        const registerBackgroundSync = async () => {
            try {
                const { backgroundSyncService } = await import('../services/background-sync.service');

                await backgroundSyncService.register();

               
            } catch (error) {
                // console.log(' bg sync not available');
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
