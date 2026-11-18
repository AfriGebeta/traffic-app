import React, { useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { showToast } from '../../../shared/utils/toast';
import { FONT_MEDIUM, RADIUS, RADIUS_SM, SectionLabel } from '../../campaigns/components/CampaignUi';
import { pickLabel } from '../services/placeCatalog';
import { businessService } from '../services/business.service';
import { UsedOffer } from '../types/business.types';

export const USED_PAGE_SIZE = 50;

const usedOn = (iso: string, lang: string) => {
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString(lang, { day: 'numeric', month: 'short' });
};

interface Props {
    rows: UsedOffer[];
    hasMore: boolean;
    loadingMore: boolean;
    onLoadMore: () => void;
    thumb: (uri?: string | null) => React.ReactNode;
    onOpen: (row: UsedOffer) => void;
    onAnswered: (code: string, feedback: 'given' | 'refused') => void;
}

export function UsedOffersSection({ rows, hasMore, loadingMore, onLoadMore, thumb, onOpen, onAnswered }: Props) {
    const { t } = useTranslation();
    const { colors: theme } = useTheme();
    const countLabel = hasMore ? `${rows.length}+` : String(rows.length);

    return (
        <View className="mb-6">
            <View className="flex-row items-baseline mb-2">
                <SectionLabel>{t('offers-used')}</SectionLabel>
                {rows.length > 0 && <Text className="text-xs ml-2" style={{ color: theme.textSecondary, fontVariant: ['tabular-nums'] }}>{countLabel}</Text>}
            </View>
            {rows.length === 0 ? (
                <Text className="text-sm" style={{ color: theme.textSecondary }}>{t('offers-used-empty')}</Text>
            ) : (
                <View style={{ borderRadius: RADIUS, borderWidth: 1, borderColor: theme.border, overflow: 'hidden' }}>
                    {rows.map((row, i) => (
                        <UsedRow key={row.code} row={row} first={i === 0} thumb={thumb} onOpen={onOpen} onAnswered={onAnswered} />
                    ))}
                    {hasMore && (
                        <TouchableOpacity
                            onPress={onLoadMore}
                            disabled={loadingMore}
                            activeOpacity={0.7}
                            className="items-center justify-center"
                            style={{ height: 44, borderTopWidth: 1, borderTopColor: theme.border }}
                        >
                            {loadingMore ? (
                                <ActivityIndicator color={theme.primary} />
                            ) : (
                                <Text style={{ color: theme.primary, fontFamily: FONT_MEDIUM, fontSize: 14 }}>{t('show-more')}</Text>
                            )}
                        </TouchableOpacity>
                    )}
                </View>
            )}
        </View>
    );
}

function UsedRow({
    row,
    first,
    thumb,
    onOpen,
    onAnswered,
}: {
    row: UsedOffer;
    first: boolean;
    thumb: Props['thumb'];
    onOpen: Props['onOpen'];
    onAnswered: Props['onAnswered'];
}) {
    const { t, i18n } = useTranslation();
    const { colors: theme } = useTheme();
    const lang = i18n.language;
    const [reporting, setReporting] = useState(false);
    const [note, setNote] = useState('');
    const [sending, setSending] = useState(false);
    const gone = !row.text;
    const meta = [pickLabel(row.place.name, lang), t('used-on', { date: usedOn(row.usedAt, lang) }), row.studentsOnly ? t('students-only') : null]
        .filter(Boolean)
        .join(' · ');

    const send = async (given: boolean) => {
        if (sending) return;
        setSending(true);
        try {
            await businessService.redemptionFeedback(row.place.id, row.code, given, given ? undefined : note);
            setReporting(false);
            onAnswered(row.code, given ? 'given' : 'refused');
        } catch {
            showToast(t('could-not-send'));
        } finally {
            setSending(false);
        }
    };

    const small = { height: 32, borderRadius: RADIUS_SM, borderWidth: 1, borderColor: theme.border } as const;

    return (
        <View className="px-3 py-3" style={{ borderTopWidth: first ? 0 : 1, borderTopColor: theme.border }}>
            <TouchableOpacity onPress={() => onOpen(row)} activeOpacity={0.7} className="flex-row items-center">
                {thumb(row.place.image)}
                <View className="flex-1 ml-3">
                    <Text
                        style={{ color: gone ? theme.textSecondary : theme.textPrimary, fontFamily: gone ? undefined : FONT_MEDIUM, fontSize: 15 }}
                        numberOfLines={2}
                    >
                        {row.text ?? t('offer-no-longer-available')}
                    </Text>
                    <Text className="text-xs mt-0.5" style={{ color: theme.textSecondary }} numberOfLines={1}>
                        {meta}
                    </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
            </TouchableOpacity>

            {row.feedback === 'given' && (
                <View className="flex-row items-center mt-2">
                    <Ionicons name="checkmark" size={14} color={theme.green} />
                    <Text className="text-xs ml-1" style={{ color: theme.textSecondary }}>{t('offer-feedback-given')}</Text>
                </View>
            )}
            {row.feedback === 'refused' && (
                <Text className="text-xs mt-2" style={{ color: theme.textSecondary }}>{t('offer-feedback-refused')}</Text>
            )}

            {row.feedback === null && !reporting && (
                <View className="flex-row items-center mt-2.5" style={{ gap: 8 }}>
                    <Text className="text-xs flex-1" style={{ color: theme.textSecondary }}>{t('did-you-get-it')}</Text>
                    <TouchableOpacity onPress={() => void send(true)} disabled={sending} activeOpacity={0.7} className="px-3 justify-center" style={small}>
                        <Text style={{ color: theme.textPrimary, fontFamily: FONT_MEDIUM, fontSize: 13 }}>{t('yes')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setReporting(true)} disabled={sending} activeOpacity={0.7} className="px-3 justify-center" style={small}>
                        <Text style={{ color: theme.textPrimary, fontFamily: FONT_MEDIUM, fontSize: 13 }}>{t('no')}</Text>
                    </TouchableOpacity>
                </View>
            )}

            {row.feedback === null && reporting && (
                <View className="mt-2.5" style={{ gap: 8 }}>
                    <TextInput
                        value={note}
                        onChangeText={setNote}
                        placeholder={t('offer-report-placeholder')}
                        placeholderTextColor={theme.textSecondary}
                        multiline
                        maxLength={300}
                        style={{
                            minHeight: 64,
                            borderRadius: RADIUS_SM,
                            borderWidth: 1,
                            borderColor: theme.border,
                            backgroundColor: theme.surface,
                            color: theme.textPrimary,
                            padding: 10,
                            fontSize: 14,
                            textAlignVertical: 'top',
                        }}
                    />
                    <View className="flex-row justify-end" style={{ gap: 8 }}>
                        <TouchableOpacity onPress={() => setReporting(false)} disabled={sending} activeOpacity={0.7} className="px-3 justify-center" style={small}>
                            <Text style={{ color: theme.textPrimary, fontSize: 13 }}>{t('cancel')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => void send(false)}
                            disabled={sending}
                            activeOpacity={0.8}
                            className="px-3 justify-center"
                            style={{ height: 32, borderRadius: RADIUS_SM, backgroundColor: theme.primary, opacity: sending ? 0.6 : 1 }}
                        >
                            {sending ? (
                                <ActivityIndicator color="#fff" size="small" />
                            ) : (
                                <Text style={{ color: '#fff', fontFamily: FONT_MEDIUM, fontSize: 13 }}>{t('send-report')}</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            )}
        </View>
    );
}
