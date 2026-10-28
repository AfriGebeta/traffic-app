import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../../shared/theme/colors';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { pickLocalized } from '../../campaigns/utils/localizedText';
import { notificationService } from '../services/notification.service';
import { InboxNotification } from '../types/notification.types';
import { hasNotificationTarget, openNotificationTarget } from '../utils/notificationTarget';
import { timeAgo } from '../utils/timeAgo';

const PAGE_SIZE = 20;

const CATEGORY_KEYS: Record<string, string> = {
    announcement: 'notification-category-announcement',
    competition: 'notification-category-competition',
    tip: 'notification-category-tip',
    system: 'notification-category-system',
};

// Inbox of everything the backend sent this user: admin messages and system updates alike
export default function NotificationsScreen() {
    const router = useRouter();
    const { t, i18n } = useTranslation();
    const insets = useSafeAreaInsets();
    const { colors: theme } = useTheme();
    // open: a delivery id to show expanded, e.g. from tapping a push that carries a full message
    const { open: openId } = useLocalSearchParams<{ open?: string }>();

    const [items, setItems] = useState<InboxNotification[]>([]);
    // messages with a full text, opened in place
    const [expanded, setExpanded] = useState<Set<string>>(() => new Set(openId ? [openId] : []));
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [unread, setUnread] = useState(0);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [failed, setFailed] = useState(false);
    // bumped on each first-page load so a slow older page can't land on top of a refresh
    const requestId = useRef(0);

    const loadFirstPage = useCallback(async () => {
        const id = ++requestId.current;
        setFailed(false);
        try {
            const inbox = await notificationService.getInbox(1, PAGE_SIZE);
            if (id !== requestId.current) return;
            setItems(inbox.data);
            setPage(1);
            setTotalPages(inbox.totalPages || 1);
            setUnread(inbox.unread ?? 0);
        } catch {
            if (id === requestId.current) setFailed(true);
        }
    }, []);

    useEffect(() => {
        void loadFirstPage().finally(() => setLoading(false));
    }, [loadFirstPage]);

    const refresh = async () => {
        setRefreshing(true);
        await loadFirstPage();
        setRefreshing(false);
    };

    const loadMore = async () => {
        if (loadingMore || loading || page >= totalPages) return;
        const id = requestId.current;
        setLoadingMore(true);
        try {
            const inbox = await notificationService.getInbox(page + 1, PAGE_SIZE);
            if (id !== requestId.current) return;
            // ids guard against items that shifted pages while scrolling
            setItems((prev) => [...prev, ...inbox.data.filter((item) => !prev.some((p) => p.id === item.id))]);
            setPage(inbox.page || page + 1);
            setTotalPages(inbox.totalPages || totalPages);
        } catch {
            // the next scroll to the end retries
        } finally {
            setLoadingMore(false);
        }
    };

    const markReadLocally = (ids: string[] | 'all') => {
        const now = new Date().toISOString();
        setItems((prev) => prev.map((item) => (ids === 'all' || ids.includes(item.id) ? { ...item, readAt: item.readAt ?? now } : item)));
    };

    const markRead = (item: InboxNotification) => {
        if (item.readAt) return;
        markReadLocally([item.id]);
        setUnread((count) => Math.max(0, count - 1));
        void notificationService.markRead(item.id, 'inbox');
    };

    // a message with a full text opens in place; anything else goes where it points
    const open = (item: InboxNotification) => {
        markRead(item);
        if (contentOf(item)) {
            setExpanded((prev) => {
                const next = new Set(prev);
                if (next.has(item.id)) next.delete(item.id);
                else next.add(item.id);
                return next;
            });
            return;
        }
        openNotificationTarget(item.data, 'inbox');
    };

    const contentOf = (item: InboxNotification) => pickLocalized(item.content, i18n.language);

    // the message a push opened counts as read once it's on screen
    useEffect(() => {
        if (!openId) return;
        const item = items.find((candidate) => candidate.id === openId);
        if (item) markRead(item);
        // markRead only changes this item's state
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [openId, items]);

    const markAllRead = () => {
        markReadLocally('all');
        setUnread(0);
        void notificationService.markAllRead();
    };

    const renderItem = ({ item }: { item: InboxNotification }) => {
        const isUnread = !item.readAt;
        const categoryKey = CATEGORY_KEYS[item.category];
        const opensScreen = hasNotificationTarget(item.data);
        const content = contentOf(item);
        const isExpanded = !!content && expanded.has(item.id);
        return (
            <TouchableOpacity
                onPress={() => open(item)}
                activeOpacity={0.7}
                className="flex-row rounded-2xl px-4 py-3.5 mb-3"
                style={{ borderWidth: 1, borderColor: isUnread ? colors.primary.main : theme.border, backgroundColor: theme.surface }}
            >
                <View className="flex-1">
                    <View className="flex-row items-center mb-1">
                        {isUnread && <View className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: colors.primary.main }} />}
                        {!!categoryKey && (
                            <Text className="text-xs font-semibold mr-2" style={{ color: colors.primary.main }}>
                                {t(categoryKey)}
                            </Text>
                        )}
                        <Text className="text-xs" style={{ color: theme.textSecondary }}>
                            {timeAgo(item.createdAt, t, i18n.language)}
                        </Text>
                    </View>
                    <Text className={isUnread ? 'text-base font-bold' : 'text-base font-semibold'} style={{ color: theme.textPrimary }}>
                        {pickLocalized(item.title, i18n.language)}
                    </Text>
                    {isExpanded ? (
                        <Text className="text-sm mt-2 leading-5" style={{ color: theme.textPrimary }}>
                            {content}
                        </Text>
                    ) : (
                        !!pickLocalized(item.body, i18n.language) && (
                            <Text className="text-sm mt-1 leading-5" style={{ color: theme.textSecondary }}>
                                {pickLocalized(item.body, i18n.language)}
                            </Text>
                        )
                    )}
                    {isExpanded && opensScreen && (
                        <TouchableOpacity
                            onPress={() => openNotificationTarget(item.data, 'inbox')}
                            activeOpacity={0.8}
                            className="self-start rounded-full px-4 py-2 mt-3"
                            style={{ backgroundColor: colors.primary.main }}
                        >
                            <Text className="font-semibold text-white">{t('notifications-open')}</Text>
                        </TouchableOpacity>
                    )}
                </View>
                {content ? (
                    <Ionicons
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={18}
                        color={theme.textSecondary}
                        style={{ alignSelf: isExpanded ? 'flex-start' : 'center', marginLeft: 8 }}
                    />
                ) : (
                    opensScreen && <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} style={{ alignSelf: 'center', marginLeft: 8 }} />
                )}
            </TouchableOpacity>
        );
    };

    return (
        <View className="flex-1" style={{ paddingTop: insets.top, backgroundColor: theme.background }}>
            <View className="px-4 py-4 flex-row items-center">
                <TouchableOpacity onPress={() => router.back()} className="mr-4" activeOpacity={0.7}>
                    <Ionicons name="arrow-back" size={26} color={theme.textPrimary} />
                </TouchableOpacity>
                <Text className="text-xl font-bold flex-1" style={{ color: theme.textPrimary }} numberOfLines={1}>
                    {t('notifications')}
                </Text>
                {unread > 0 && (
                    <TouchableOpacity onPress={markAllRead} hitSlop={8} activeOpacity={0.7}>
                        <Text className="font-semibold" style={{ color: colors.primary.main }}>
                            {t('notifications-mark-all-read')}
                        </Text>
                    </TouchableOpacity>
                )}
            </View>

            {loading ? (
                <ActivityIndicator className="mt-8" color={colors.primary.main} />
            ) : (
                <FlatList
                    data={items}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24, flexGrow: 1 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
                    onEndReached={() => void loadMore()}
                    onEndReachedThreshold={0.4}
                    ListFooterComponent={loadingMore ? <ActivityIndicator className="my-4" color={colors.primary.main} /> : null}
                    ListEmptyComponent={
                        <View className="items-center mt-16 px-6">
                            <Ionicons name={failed ? 'cloud-offline-outline' : 'notifications-outline'} size={44} color={theme.textSecondary} />
                            <Text className="text-center mt-3" style={{ color: theme.textSecondary }}>
                                {t(failed ? 'notifications-failed' : 'notifications-empty')}
                            </Text>
                            {failed && (
                                <TouchableOpacity onPress={() => void refresh()} className="mt-3" activeOpacity={0.7}>
                                    <Text className="font-semibold" style={{ color: colors.primary.main }}>
                                        {t('try-again')}
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    }
                />
            )}
        </View>
    );
}
