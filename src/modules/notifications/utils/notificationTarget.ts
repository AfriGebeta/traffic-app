import { router } from 'expo-router';
import { getCampaignState } from '../../campaigns/store/campaignStore';
import { NotificationData } from '../types/notification.types';

const str = (data: NotificationData | null | undefined, key: string): string => {
    const value = data?.[key];
    return typeof value === 'string' ? value : '';
};

// the campaign a link means: the slug it names, else the running (live) one we know about
const campaignSlug = (slug: string): string | null =>
    slug || (getCampaignState().campaigns.find((campaign) => campaign.phase === 'live') ?? getCampaignState().campaigns[0])?.slug || null;

type Target = (() => void) | 'home';

const adminLinkTarget = (data: NotificationData | null | undefined): Target => {
    const slug = campaignSlug(str(data, 'campaign'));
    switch (str(data, 'link')) {
        case 'campaign':
            return () => (slug ? router.push({ pathname: '/campaigns/[slug]', params: { slug } }) : router.push('/campaigns'));
        case 'leaderboard':
            return () => (slug ? router.push({ pathname: '/campaigns/[slug]/leaderboard', params: { slug } }) : router.push('/campaigns'));
        case 'contribute':
            return () => router.push('/contribution');
        case 'report':
            // the report sheet lives on the map; the nonce makes a repeat tap open it again
            return () => router.dismissTo({ pathname: '/', params: { openReport: String(Date.now()) } });
        case 'profile':
            return () => router.push('/profile');
        default:
            return 'home';
    }
};

const targetFor = (data: NotificationData | null | undefined): Target => {
    switch (str(data, 'event')) {
        case 'submission.verified':
        case 'submission.rejected':
            return () => router.push('/my-contributions');
        case 'support_ticket.resolved':
            return () => router.push('/contact-support');
        case 'admin.notification':
            return adminLinkTarget(data);
        default:
            return 'home';
    }
};

// whether tapping this notification leads anywhere beyond home (the inbox only shows a chevron then)
export const hasNotificationTarget = (data: NotificationData | null | undefined) => targetFor(data) !== 'home';

export const openNotificationTarget = (data: NotificationData | null | undefined, from: 'push' | 'inbox', deliveryId?: string) => {
    // a push only carries the teaser of a long message; the inbox shows the full text, opened
    const hasContent = data?.hasContent === true || data?.hasContent === 'true';
    if (from === 'push' && hasContent) {
        router.push({ pathname: '/notifications', params: deliveryId ? { open: deliveryId } : {} });
        return;
    }
    const target = targetFor(data);
    if (target !== 'home') target();
    else if (from === 'push') router.dismissTo('/');
};
