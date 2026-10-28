import { LocalizedText } from '../../campaigns/types/campaign.types';

export type NotificationCategory = 'announcement' | 'competition' | 'tip' | 'system' | string;

// what the push carried in `data`; inbox items keep the same fields (values may be numbers here)
export type NotificationData = Record<string, string | number | boolean | object | null | undefined>;

export interface InboxNotification {
    // the delivery id: what /inbox/:id/read takes
    id: string;
    event: string;
    category: NotificationCategory;
    title: LocalizedText;
    body: LocalizedText;
    data?: NotificationData | null;
    readAt: string | null;
    createdAt: string;
    // the full message for long admin notifications (data.hasContent); title/body are then just the teaser
    content?: LocalizedText | null;
}

export interface InboxPage {
    data: InboxNotification[];
    total: number;
    unread: number;
    page: number;
    totalPages: number;
}

// "push" when opened from the system notification, "inbox" from the in-app list
export type ReadVia = 'push' | 'inbox';
