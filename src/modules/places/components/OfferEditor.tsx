import React, { useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Input } from '../../../shared/components';
import { FieldLabel } from '../../../shared/components/FieldLabel';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { showToast } from '../../../shared/utils/toast';
import { ApiError } from '../../../shared/utils/apiErrors';
import { FONT_MEDIUM, RADIUS_SM, tint } from '../../campaigns/components/CampaignUi';
import { businessService } from '../services/business.service';
import { isActive, pickLabel } from '../services/placeCatalog';
import { BusinessOffer, CatalogOption, OfferField, OfferIdea, PlaceCatalog } from '../types/business.types';
import { BusinessDraft, DEFAULT_OFFER_DAYS, MAX_OFFERS, addDays, hoursText, isoDate, offerMissing, offerPreview, offerUsesPin, randomPin } from '../utils/businessDraft';
import { ChipSelect, DateField, FormSection, SelectField } from './FormControls';

interface Props {
    draft: BusinessDraft;
    onChange: (patch: Partial<BusinessDraft>) => void;
    catalog: PlaceCatalog;
    placeName: string;
    description: string;
}

type Suggestion = { label: string; why?: string; offer: Partial<BusinessOffer> };

export function OfferEditor({ draft, onChange, catalog, placeName, description }: Props) {
    const { t, i18n } = useTranslation();
    const { colors: theme } = useTheme();
    const lang = i18n.language;
    const options = catalog.offerOptions;
    const types = options.types.filter(isActive);
    const group = catalog.businessGroups.find((g) => g.key === draft.group);
    const products = (group?.products ?? []).map((p) => pickLabel(p.label, 'en', p.key));
    const [ideas, setIdeas] = useState<Suggestion[] | null>(null);
    const [loadingIdeas, setLoadingIdeas] = useState(false);

    const firstKey = (list: CatalogOption[]) => list.filter(isActive)[0]?.key;
    const newOffer = ({ months: _months, ...base }: Partial<BusinessOffer> = {}): BusinessOffer => {
        const today = isoDate(new Date());
        return {
            type: types[0]?.key ?? 'percent',
            startsOn: today,
            endsOn: addDays(today, DEFAULT_OFFER_DAYS),
            audience: firstKey(options.audience),
        days: firstKey(options.days),
        time: firstKey(options.time),
        redeem: firstKey(options.redeem),
            limit: firstKey(options.limit),
            ...base,
        };
    };

    const setOffer = (index: number, patch: Partial<BusinessOffer>) =>
        onChange({ offers: draft.offers.map((offer, i) => (i === index ? { ...offer, ...patch } : offer)) });

    const addOffer = (base?: Partial<BusinessOffer>) => {
        if (draft.offers.length >= MAX_OFFERS) {
            showToast(t('max-offers', { max: MAX_OFFERS }));
            return;
        }
        onChange({ offers: [...draft.offers, newOffer(base)] });
    };

    const loadIdeas = async () => {
        setLoadingIdeas(true);
        const fallback = (group?.suggestions ?? []).map(({ label, ...offer }) => ({ label, offer: offer as Partial<BusinessOffer> }));
        try {
            const hours = hoursText(draft, catalog);
            const result: OfferIdea[] = await businessService.offerIdeas({
                name: placeName.trim() || undefined,
                group: draft.group,
                kind: draft.kind,
                products: draft.products,
                ...(draft.spend && { spend: draft.spend }),
                ...(draft.features.length && { features: draft.features }),
                ...(draft.payments.length && { payments: draft.payments }),
                // offer-ideas takes hours as one line of text, not the per-day object
                ...(hours && { hours }),
                ...(description.trim() && { description: description.trim() }),
                existingOffers: draft.offers,
            });
            setIdeas(result.length ? result : fallback);
        } catch (error) {
            // 429: ideas unavailable right now, use the group's suggestions
            if (!(error instanceof ApiError && error.status === 429)) console.warn('[offer-ideas]', error);
            setIdeas(fallback);
        } finally {
            setLoadingIdeas(false);
        }
    };

    const renderField = (offer: BusinessOffer, index: number, field: OfferField) => {
        const value = offer[field.key];
        const label = pickLabel(field.label, lang, field.key);
        if (field.input === 'select') {
            return (
                <View key={field.key}>
                    <FieldLabel label={label} required={field.required} />
                    <SelectField
                        title={label}
                        placeholder={t('choose')}
                        options={(field.options ?? []).map((o) => ({ value: String(o.value), label: pickLabel(o.label, lang, String(o.value)) }))}
                        value={value === undefined || value === null ? null : String(value)}
                        onChange={(next) => {
                            const option = field.options?.find((o) => String(o.value) === next);
                            setOffer(index, { [field.key]: option ? option.value : undefined });
                        }}
                        clearable={!field.required}
                    />
                </View>
            );
        }
        if (field.input === 'number') {
            return (
                <View key={field.key}>
                    <FieldLabel label={label} required={field.required} />
                    <Input
                        variant="calm"
                        placeholder="0"
                        value={value === undefined ? '' : String(value)}
                        // a JSON number, not a string
                        onChangeText={(text) => {
                            const digits = text.replace(/\D/g, '');
                            setOffer(index, { [field.key]: digits ? Number(digits) : undefined });
                        }}
                        keyboardType="number-pad"
                    />
                </View>
            );
        }
        // item: text with the group's products as quick picks
        return (
            <View key={field.key}>
                <FieldLabel label={label} required={field.required} />
                <Input variant="calm" placeholder={label} value={String(value ?? '')} onChangeText={(text) => setOffer(index, { [field.key]: text })} />
                {field.input === 'item' && products.length > 0 && (
                    <View className="mt-2">
                        <ChipSelect
                            options={products.slice(0, 8).map((p) => ({ value: p, label: p }))}
                            selected={value ? [String(value)] : []}
                            onToggle={(p) => setOffer(index, { [field.key]: value === p ? '' : p })}
                        />
                    </View>
                )}
            </View>
        );
    };

    const commonSelect = (offer: BusinessOffer, index: number, key: 'audience' | 'days' | 'time' | 'redeem' | 'limit', list: CatalogOption[]) => (
        <View key={key}>
            <FieldLabel label={t(`offer-${key}`)} required />
            <SelectField
                title={t(`offer-${key}`)}
                placeholder={t('choose')}
                options={list.filter(isActive).map((o) => ({ value: o.key, label: pickLabel(o.label, lang, o.key) }))}
                value={(offer[key] as string) ?? null}
                onChange={(next) => setOffer(index, { [key]: next ?? undefined })}
            />
        </View>
    );

    return (
        <View className="gap-4">
            {draft.offers.map((offer, index) => {
                const type = types.find((ty) => ty.key === offer.type) ?? options.types.find((ty) => ty.key === offer.type);
                const missing = offerMissing(offer, type);
                const ended = !!offer.endedOn;
                const preview = String(offer.title ?? '').trim() || offerPreview(offer);
                const badge = type ? (offer.redeem === 'code-with-pin' && type.badge === 'Offer' ? 'Code' : type.badge) : '';
                return (
                    <FormSection
                        key={offer.id ?? `new-${index}`}
                        title={t('offer-n', { n: index + 1 })}
                        subtitle={ended ? t('offer-ended') : offer.paused ? t('offer-paused') : undefined}
                        right={
                            ended ? undefined : (
                                <TouchableOpacity onPress={() => onChange({ offers: draft.offers.filter((_, i) => i !== index) })} hitSlop={8}>
                                    <Ionicons name="trash-outline" size={18} color={theme.error} />
                                </TouchableOpacity>
                            )
                        }
                    >
                        <View pointerEvents={ended ? 'none' : 'auto'} className="gap-4" style={{ opacity: ended ? 0.55 : 1 }}>
                        <View>
                            <FieldLabel label={t('offer-type')} required />
                            <SelectField
                                title={t('offer-type')}
                                placeholder={t('choose')}
                                options={types.map((ty) => ({ value: ty.key, label: pickLabel(ty.label, lang, ty.key) }))}
                                value={offer.type}
                                // keep the shared fields, drop the old type's own fields
                                onChange={(next) => {
                                    if (!next || next === offer.type) return;
                                    const nextType = options.types.find((ty) => ty.key === next);
                                    const shared = new Set<string>(['id', 'paused', ...(nextType?.common ?? [])]);
                                    const kept = Object.fromEntries(Object.entries(offer).filter(([key]) => shared.has(key)));
                                    onChange({
                                        offers: draft.offers.map((o, i) => (i === index ? ({ ...kept, type: next } as BusinessOffer) : o)),
                                    });
                                }}
                            />
                        </View>

                        {type?.fields.map((field) => renderField(offer, index, field))}

                        <View className="flex-row gap-3">
                            <View className="flex-1">
                                <FieldLabel label={t('offer-starts')} required />
                                <DateField
                                    value={offer.startsOn}
                                    placeholder={t('choose')}
                                    doneLabel={t('done')}
                                    // moving the start past the end pulls the end along
                                    onChange={(startsOn) => setOffer(index, { startsOn, ...(offer.endsOn && offer.endsOn < startsOn && { endsOn: startsOn }) })}
                                />
                            </View>
                            <View className="flex-1">
                                <FieldLabel label={t('offer-ends')} required />
                                <DateField
                                    value={offer.endsOn}
                                    minimumDate={offer.startsOn}
                                    placeholder={t('choose')}
                                    doneLabel={t('done')}
                                    onChange={(endsOn) => setOffer(index, { endsOn })}
                                />
                            </View>
                        </View>

                        {type?.common.includes('title') && (
                            <View>
                                <FieldLabel label={t('offer-title')} optional hint={t('offer-title-hint')} />
                                <Input
                                    variant="calm"
                                    placeholder={offerPreview(offer) || t('offer-title')}
                                    value={String(offer.title ?? '')}
                                    onChangeText={(title) => setOffer(index, { title })}
                                    maxLength={80}
                                />
                            </View>
                        )}

                        {type?.common.includes('audience') && commonSelect(offer, index, 'audience', options.audience)}
                        {type?.common.includes('days') && commonSelect(offer, index, 'days', options.days)}
                        {type?.common.includes('time') && commonSelect(offer, index, 'time', options.time)}
                        {type?.common.includes('redeem') && commonSelect(offer, index, 'redeem', options.redeem)}
                        {type?.common.includes('limit') && commonSelect(offer, index, 'limit', options.limit)}
                        {type?.common.includes('season') && (
                            <View>
                                <FieldLabel label={t('offer-season')} optional />
                                <SelectField
                                    title={t('offer-season')}
                                    placeholder={t('choose')}
                                    options={catalog.seasons.filter(isActive).map((s) => ({ value: s.key, label: pickLabel(s.label, lang, s.key) }))}
                                    value={(offer.season as string) ?? null}
                                    onChange={(season) => setOffer(index, { season: season ?? undefined })}
                                    clearable
                                />
                            </View>
                        )}

                        <View className="p-3" style={{ borderRadius: RADIUS_SM, backgroundColor: tint(theme.primary, '14') }}>
                            <Text className="text-xs" style={{ color: theme.textSecondary }}>{t('offer-preview')}</Text>
                            <View className="flex-row items-center mt-1">
                                {!!badge && (
                                    <View className="px-1.5 py-0.5 mr-2" style={{ borderRadius: 4, backgroundColor: theme.primary }}>
                                        <Text style={{ color: '#fff', fontSize: 11, fontFamily: FONT_MEDIUM }}>{badge}</Text>
                                    </View>
                                )}
                                <Text className="flex-1 text-sm" style={{ color: preview ? theme.textPrimary : theme.textSecondary, fontFamily: FONT_MEDIUM }}>
                                    {preview || t('offer-preview-empty')}
                                </Text>
                            </View>
                        </View>
                        {!ended && missing.length > 0 && <Text className="text-xs" style={{ color: theme.error }}>{t('offer-fill-required')}</Text>}
                        </View>
                    </FormSection>
                );
            })}

            {draft.offers.length < MAX_OFFERS && (
                <TouchableOpacity
                    onPress={() => addOffer()}
                    activeOpacity={0.7}
                    className="flex-row items-center justify-center py-3"
                    style={{ borderRadius: RADIUS_SM, borderWidth: 1, borderColor: theme.primary, borderStyle: 'dashed' }}
                >
                    <Ionicons name="add" size={18} color={theme.primary} />
                    <Text className="ml-1 text-sm" style={{ color: theme.primary, fontFamily: FONT_MEDIUM }}>{t('add-offer')}</Text>
                </TouchableOpacity>
            )}

            <View className="p-4" style={{ borderRadius: RADIUS_SM, borderWidth: 1, borderColor: tint(theme.primary, '99'), backgroundColor: tint(theme.primary, '14') }}>
                <View className="flex-row items-center">
                    <View className="flex-1 mr-3">
                        <Text style={{ color: theme.textPrimary, fontFamily: FONT_MEDIUM, fontSize: 15 }}>{t('offer-ideas')}</Text>
                        <Text className="text-xs mt-0.5" style={{ color: theme.textSecondary }}>{t('offer-ideas-description')}</Text>
                    </View>
                    <TouchableOpacity
                        onPress={() => void loadIdeas()}
                        disabled={loadingIdeas || !draft.kind}
                        activeOpacity={0.7}
                        className="items-center justify-center px-3.5"
                        style={{ minHeight: 36, minWidth: 92, borderRadius: RADIUS_SM, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, opacity: draft.kind ? 1 : 0.5 }}
                    >
                        {loadingIdeas ? (
                            <ActivityIndicator size="small" color={theme.primary} />
                        ) : (
                            <Text className="text-sm" style={{ color: theme.textPrimary, fontFamily: FONT_MEDIUM }}>{ideas ? t('more-ideas') : t('get-ideas')}</Text>
                        )}
                    </TouchableOpacity>
                </View>
                {ideas !== null && (
                    <View className="gap-4 mt-4 pt-4" style={{ borderTopWidth: 1, borderTopColor: theme.border }}>
                        {ideas.length === 0 ? (
                            <Text className="text-sm" style={{ color: theme.textSecondary }}>{t('no-offer-ideas')}</Text>
                        ) : (
                            ideas.map((idea, i) => (
                                <TouchableOpacity
                                    key={i}
                                    onPress={() => {
                                        const { id: _id, paused: _paused, text: _text, ...offer } = idea.offer as BusinessOffer;
                                        addOffer(offer);
                                    }}
                                    activeOpacity={0.7}
                                    className="flex-row items-center"
                                >
                                    <View className="flex-1">
                                        <Text className="text-sm" style={{ color: theme.textPrimary, fontFamily: FONT_MEDIUM }}>{idea.label}</Text>
                                        {!!idea.why && <Text className="text-xs mt-0.5" style={{ color: theme.textSecondary }}>{idea.why}</Text>}
                                    </View>
                                    <Ionicons name="add-circle-outline" size={20} color={theme.primary} />
                                </TouchableOpacity>
                            ))
                        )}
                    </View>
                )}
            </View>

            {offerUsesPin(draft.offers) && (
                <View>
                    <FieldLabel label={t('shop-pin')} optional hint={t('shop-pin-hint')} />
                    <View className="flex-row items-center gap-3">
                        <View className="flex-1">
                            <Input
                                variant="calm"
                                placeholder={t('shop-pin-placeholder')}
                                value={draft.pin}
                                onChangeText={(text) => onChange({ pin: text.replace(/\D/g, '').slice(0, 4) })}
                                keyboardType="number-pad"
                                maxLength={4}
                            />
                        </View>
                        <TouchableOpacity onPress={() => onChange({ pin: randomPin() })} className="px-3 py-3" style={{ borderRadius: RADIUS_SM, borderWidth: 1, borderColor: theme.border }}>
                            <Text className="text-sm" style={{ color: theme.primary, fontFamily: FONT_MEDIUM }}>{t('new-pin')}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}
        </View>
    );
}
