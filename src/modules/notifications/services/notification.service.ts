import { apiService } from '../../../shared/services/api';
import { ApiError } from '../../../shared/utils/apiErrors';
import { InboxPage, ReadVia } from '../types/notification.types';

const INBOX_PATH = '/api/notifications/inbox';

export const notificationService = {
    // the body is the page itself: { data: [...], total, unread, page, totalPages }
    async getInbox(page = 1, pageSize = 20): Promise<InboxPage> {
        const response = await apiService.get<InboxPage>(`${INBOX_PATH}?page=${page}&pageSize=${pageSize}`);
        if (response.error || !response.data) throw new ApiError(response, 'Failed to load notifications');
        return response.data;
    },

    async getUnreadCount(): Promise<number> {
        const response = await apiService.get<{ data: { unread: number } }>(`${INBOX_PATH}/unread-count`);
        if (response.error || !response.data) throw new ApiError(response, 'Failed to load unread count');
        return response.data.data?.unread ?? 0;
    },

    // callers fire and forget; a failure only means it stays unread
    async markRead(deliveryId: string, via: ReadVia): Promise<boolean> {
        const response = await apiService.post(`${INBOX_PATH}/${encodeURIComponent(deliveryId)}/read`, { via });
        console.log('[notifications] marked read', deliveryId, `via ${via}`, response.error ? `failed ${response.status}` : 'ok');
        return !response.error;
    },

    async markAllRead(): Promise<boolean> {
        const response = await apiService.post(`${INBOX_PATH}/read-all`);
        return !response.error;
    },
};
