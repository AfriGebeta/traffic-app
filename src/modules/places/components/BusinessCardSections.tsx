import React from 'react';
import { Image, Linking, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { FONT_MEDIUM, RADIUS, tint } from '../../campaigns/components/CampaignUi';
import { isActive, pickLabel } from '../services/placeCatalog';
import { PlaceCatalog, PublicOffer, PublicPlace } from '../types/business.types';
import { parseIsoDate } from '../utils/businessDraft';
import { OpenState, telUrl, telegramHandle, websiteUrl, weekHours } from '../utils/businessPlace';

export const shortDate = (iso: string | null | undefined, lang: string) =>
    parseIsoDate(iso)?.toLocaleDateString(lang, { day: 'numeric', month: 'short' }) ?? '';

export function OpenLine({ state }: { state: OpenState }) {
    const { t } = useTranslation();
    const { colors: theme } = useTheme();
    if (state.open === null) return null;
    const closes = state.today && state.today !== 'closed' ? state.today.split('-')[1] : null;
    return (
        <Text className="text-xs" style={{ color: theme.textSecondary }}>
            <Text style={{ color: state.open ? theme.green : theme.error, fontFamily: FONT_MEDIUM }}>{t(state.open ? 'open-now' : 'closed-now')}</Text>
            {state.open && closes ? ` · ${t('closes-at', { time: closes })}` : ''}
        </Text>
    );
}

export function CardOffer({
    offer,
    moreCount,
    image,
    catalog,
    onUse,
}: {
    offer: PublicOffer;
    moreCount: number;
    image?: string | null;
    catalog: PlaceCatalog | null;
    onUse: () => void;
}) {
    const { t, i18n } = useTranslation();
    const { colors: theme } = useTheme();
    const lang = i18n.language;
    const isAnnouncement = offer.type === 'announce';
    const usable = offer.availableNow && !isAnnouncement;
    const kind = pickLabel(catalog?.offerOptions.types.find((ty) => ty.key === offer.type)?.label, lang, offer.badge);
    const meta = [offer.endsOn ? t('ends-on', { date: shortDate(offer.endsOn, lang) }) : null, moreCount > 0 ? t('more-offers-count', { count: moreCount }) : null]
        .filter(Boolean)
        .join(' · ');

    return (
        <TouchableOpacity
            onPress={onUse}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={`${kind}: ${offer.text}`}
            className="flex-row overflow-hidden"
            style={{ borderRadius: RADIUS, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.background }}
        >
            {!!image && <Image source={{ uri: image }} style={{ width: 72, backgroundColor: theme.surface }} resizeMode="cover" />}
            <View className="flex-1 px-3 py-2.5">
                <View className="flex-row items-center gap-1.5">
                    <View className="px-1.5 py-0.5" style={{ borderRadius: 4, backgroundColor: tint(theme.primary, '24') }}>
                        <Text style={{ color: theme.textPrimary, fontSize: 11, fontFamily: FONT_MEDIUM }}>{kind}</Text>
                    </View>
                    {/* always say who it's for, so an untagged offer is never a guess */}
                    <View className="px-1.5 py-0.5" style={{ borderRadius: 4, backgroundColor: theme.surface }}>
                        <Text style={{ color: theme.textSecondary, fontSize: 11, fontFamily: FONT_MEDIUM }}>{t(offer.studentsOnly ? 'students-only' : 'everyone')}</Text>
                    </View>
                </View>

                <Text className="mt-1.5" style={{ color: theme.textPrimary, fontFamily: FONT_MEDIUM, fontSize: 15, lineHeight: 20 }} numberOfLines={2}>
                    {offer.text}
                </Text>

                <View className="flex-row items-center mt-1.5">
                    <Text className="flex-1 text-xs" style={{ color: theme.textSecondary, fontVariant: ['tabular-nums'] }} numberOfLines={1}>
                        {meta}
                    </Text>
                    {!isAnnouncement &&
                        (usable ? (
                            <View className="flex-row items-center">
                                <Text style={{ color: theme.primary, fontFamily: FONT_MEDIUM, fontSize: 13 }}>{t('use-offer')}</Text>
                                <Ionicons name="chevron-forward" size={14} color={theme.primary} />
                            </View>
                        ) : (
                            <Text style={{ color: theme.textSecondary, fontSize: 12 }}>{t('offer-not-now')}</Text>
                        ))}
                </View>
            </View>
        </TouchableOpacity>
    );
}

const DetailRow = ({ icon, children, onPress }: { icon: React.ComponentProps<typeof Ionicons>['name']; children: React.ReactNode; onPress?: () => void }) => {
    const { colors: theme } = useTheme();
    const body = (
        <View className="flex-row items-start py-2.5">
            <Ionicons name={icon} size={17} color={theme.textSecondary} style={{ marginTop: 1, marginRight: 10 }} />
            <View className="flex-1">{children}</View>
        </View>
    );
    return onPress ? (
        <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
            {body}
        </TouchableOpacity>
    ) : (
        body
    );
};

export function CardDetails({
    place,
    openNow,
    catalog,
    onCall,
}: {
    place: PublicPlace;
    openNow: OpenState;
    catalog: PlaceCatalog | null;
    onCall: (url: string) => void;
}) {
    const { t, i18n } = useTranslation();
    const { colors: theme } = useTheme();
    const lang = i18n.language;
    const business = place.business ?? {};
    const address = [business.landmark, place.formattedAddress].filter(Boolean).join(', ');
    const phones = [place.phone, business.phone2].filter((p): p is string => !!p && !!telUrl(p));
    const site = websiteUrl(place.website);
    const telegram = telegramHandle(business.telegram);
    const group = catalog?.businessGroups.find((g) => g.key === business.group);
    const features = (business.features ?? []).map((key) => pickLabel(group?.features.filter(isActive).find((f) => f.key === key)?.label, lang, key));
    const week = weekHours(place.openingHours);
    const textStyle = { color: theme.textPrimary, fontSize: 14 } as const;

    return (
        <View>
            {!!address && (
                <DetailRow icon="location-outline">
                    <Text style={textStyle}>{address}</Text>
                </DetailRow>
            )}
            {week.length > 0 && (
                <DetailRow icon="time-outline">
                    <OpenLine state={openNow} />
                    {week.map(({ day, value }) => (
                        <Text key={day} className="text-xs mt-0.5" style={{ color: theme.textSecondary, fontVariant: ['tabular-nums'] }}>
                            {t(`day-${day}`)}  {value === 'closed' ? t('closed-now') : value}
                        </Text>
                    ))}
                </DetailRow>
            )}
            {phones.map((phone) => (
                <DetailRow key={phone} icon="call-outline" onPress={() => onCall(telUrl(phone)!)}>
                    <Text style={{ ...textStyle, color: theme.primary }}>{phone}</Text>
                </DetailRow>
            ))}
            {!!site && (
                <DetailRow icon="globe-outline" onPress={() => void Linking.openURL(site).catch(() => undefined)}>
                    <Text style={{ ...textStyle, color: theme.primary }} numberOfLines={1}>
                        {site.replace(/^https?:\/\//i, '')}
                    </Text>
                </DetailRow>
            )}
            {!!telegram && (
                <DetailRow icon="paper-plane-outline" onPress={() => void Linking.openURL(`https://t.me/${telegram}`).catch(() => undefined)}>
                    <Text style={{ ...textStyle, color: theme.primary }}>@{telegram}</Text>
                </DetailRow>
            )}
            {features.length > 0 && (
                <View className="flex-row flex-wrap gap-1.5 pt-2">
                    {features.map((label) => (
                        <View key={label} className="px-2 py-0.5" style={{ borderRadius: 4, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }}>
                            <Text style={{ color: theme.textSecondary, fontSize: 11 }}>{label}</Text>
                        </View>
                    ))}
                </View>
            )}
        </View>
    );
}
