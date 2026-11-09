import React, { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Input } from '../../../shared/components';
import { FieldLabel } from '../../../shared/components/FieldLabel';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { FONT_MEDIUM } from '../../campaigns/components/CampaignUi';
import { pickLabel } from '../services/placeCatalog';
import { PAYMENT_METHODS, PlaceCatalog, SPEND_LEVELS } from '../types/business.types';
import { BusinessDraft, WalletDraft } from '../utils/businessDraft';
import { ChipSelect, FormSection, SelectField, toggleIn } from './FormControls';

interface Props {
    draft: BusinessDraft;
    onChange: (patch: Partial<BusinessDraft>) => void;
    catalog: PlaceCatalog;
}

// data collectors only: spend, products, payments (+ details), features, notes
export function CollectorFields({ draft, onChange, catalog }: Props) {
    const { t, i18n } = useTranslation();
    const { colors: theme } = useTheme();
    const lang = i18n.language;
    const group = catalog.businessGroups.find((g) => g.key === draft.group);
    const [customProduct, setCustomProduct] = useState('');

    // products are free text: the group's list (in English, as the backend shows them) plus the collector's own
    const groupProducts = (group?.products ?? []).map((p) => pickLabel(p.label, 'en', p.key));
    const extraProducts = draft.products.filter((p) => !groupProducts.includes(p));
    const addCustomProduct = () => {
        const value = customProduct.trim();
        if (!value) return;
        if (!draft.products.includes(value)) onChange({ products: [...draft.products, value] });
        setCustomProduct('');
    };

    const walletFields = (key: 'telebirr' | 'mpesa', toOptions: { value: string; label: string }[]) => {
        const wallet: WalletDraft = draft[key];
        const set = (patch: Partial<WalletDraft>) => onChange({ [key]: { ...wallet, ...patch } } as Partial<BusinessDraft>);
        return (
            <FormSection title={t(`payment-${key}`)}>
                <View>
                    <FieldLabel label={t('pays-to')} />
                    <SelectField title={t('pays-to')} placeholder={t('choose')} options={toOptions} value={wallet.to} onChange={(to) => set({ to: to ?? toOptions[0].value })} />
                </View>
                <View>
                    <FieldLabel label={wallet.to === 'phone' ? t('phone-number') : t(key === 'telebirr' ? 'merchant-id' : 'till-number')} />
                    <Input variant="calm" placeholder={wallet.to === 'phone' ? '09…' : '512345'} value={wallet.number} onChangeText={(number) => set({ number })} keyboardType="number-pad" />
                </View>
                <View>
                    <FieldLabel label={t('account-name')} />
                    <Input variant="calm" placeholder={t('account-name-placeholder')} value={wallet.name} onChangeText={(name) => set({ name })} />
                </View>
            </FormSection>
        );
    };

    const setBank = (index: number, patch: Partial<BusinessDraft['banks'][number]>) =>
        onChange({ banks: draft.banks.map((bank, i) => (i === index ? { ...bank, ...patch } : bank)) });

    return (
        <View className="gap-5">
            <View>
                <FieldLabel label={t('typical-spend')} optional />
                <ChipSelect
                    options={SPEND_LEVELS.map((level) => ({ value: level, label: t(`spend-${level}`) }))}
                    selected={draft.spend ? [draft.spend] : []}
                    onToggle={(level) => onChange({ spend: draft.spend === level ? null : level })}
                />
            </View>

            {!!group && (
                <View>
                    <FieldLabel label={t('what-they-sell')} optional />
                    {groupProducts.length > 0 && (
                        <ChipSelect
                            options={[...groupProducts, ...extraProducts].map((p) => ({ value: p, label: p }))}
                            selected={draft.products}
                            onToggle={(p) => onChange({ products: toggleIn(draft.products, p) })}
                        />
                    )}
                    <View className="flex-row items-center gap-2 mt-2">
                        <View className="flex-1">
                            <Input variant="calm" placeholder={t('add-own-item')} value={customProduct} onChangeText={setCustomProduct} onSubmitEditing={addCustomProduct} returnKeyType="done" />
                        </View>
                        <TouchableOpacity onPress={addCustomProduct} hitSlop={6} className="p-2">
                            <Ionicons name="add-circle" size={28} color={customProduct.trim() ? theme.primary : theme.border} />
                        </TouchableOpacity>
                    </View>
                    {groupProducts.length === 0 && extraProducts.length > 0 && (
                        <View className="mt-2">
                            <ChipSelect options={extraProducts.map((p) => ({ value: p, label: p }))} selected={draft.products} onToggle={(p) => onChange({ products: toggleIn(draft.products, p) })} />
                        </View>
                    )}
                </View>
            )}

            <View>
                <FieldLabel label={t('payments-accepted')} optional />
                <ChipSelect
                    options={PAYMENT_METHODS.map((method) => ({ value: method, label: t(`payment-${method}`) }))}
                    selected={draft.payments}
                    onToggle={(method) => onChange({ payments: toggleIn(draft.payments, method) })}
                />
            </View>

            {draft.payments.includes('telebirr') &&
                walletFields('telebirr', [
                    { value: 'merchant', label: t('pays-to-merchant') },
                    { value: 'phone', label: t('phone-number') },
                ])}
            {draft.payments.includes('mpesa') &&
                walletFields('mpesa', [
                    { value: 'till', label: t('pays-to-till') },
                    { value: 'phone', label: t('phone-number') },
                ])}
            {draft.payments.includes('cbe-birr') && (
                <FormSection title={t('payment-cbe-birr')}>
                    <View>
                        <FieldLabel label={t('cbe-birr-number')} />
                        <Input variant="calm" placeholder="09…" value={draft.cbeBirr.number} onChangeText={(number) => onChange({ cbeBirr: { ...draft.cbeBirr, number } })} keyboardType="number-pad" />
                    </View>
                    <View>
                        <FieldLabel label={t('account-name')} />
                        <Input variant="calm" placeholder={t('account-name-placeholder')} value={draft.cbeBirr.name} onChangeText={(name) => onChange({ cbeBirr: { ...draft.cbeBirr, name } })} />
                    </View>
                </FormSection>
            )}
            {draft.payments.includes('bank-transfer') && (
                <FormSection title={t('payment-bank-transfer')} subtitle={t('up-to-two-banks')}>
                    {draft.banks.map((bank, index) => (
                        <View key={index} className="gap-3">
                            {index > 0 && <View className="h-px" style={{ backgroundColor: theme.border }} />}
                            <SelectField
                                title={t('bank')}
                                placeholder={t('bank')}
                                options={catalog.banks.map((name) => ({ value: name, label: name }))}
                                value={bank.bank || null}
                                onChange={(name) => setBank(index, { bank: name ?? '' })}
                                clearable
                                searchPlaceholder={t('search')}
                                emptyText={t('no-results')}
                            />
                            <Input variant="calm" placeholder={t('account-name')} value={bank.name} onChangeText={(name) => setBank(index, { name })} />
                            <Input variant="calm" placeholder={t('account-number')} value={bank.number} onChangeText={(number) => setBank(index, { number })} keyboardType="number-pad" />
                        </View>
                    ))}
                    {draft.banks.length < 2 ? (
                        <TouchableOpacity onPress={() => onChange({ banks: [...draft.banks, { bank: '', name: '', number: '' }] })} className="self-start" hitSlop={6}>
                            <Text className="text-sm" style={{ color: theme.primary, fontFamily: FONT_MEDIUM }}>+ {t('add-second-bank')}</Text>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity onPress={() => onChange({ banks: draft.banks.slice(0, 1) })} className="self-start" hitSlop={6}>
                            <Text className="text-sm" style={{ color: theme.error, fontFamily: FONT_MEDIUM }}>{t('remove-second-bank')}</Text>
                        </TouchableOpacity>
                    )}
                </FormSection>
            )}

            {!!group && group.features.length > 0 && (
                <View>
                    <FieldLabel label={t('business-features')} optional />
                    <ChipSelect
                        options={group.features.map((f) => ({ value: f.key, label: pickLabel(f.label, lang, f.key) }))}
                        selected={draft.features}
                        onToggle={(f) => onChange({ features: toggleIn(draft.features, f) })}
                    />
                </View>
            )}

            <View>
                <FieldLabel label={t('collector-notes')} optional hint={t('collector-notes-hint')} />
                <Input variant="calm" placeholder={t('collector-notes-placeholder')} value={draft.notes} onChangeText={(notes) => onChange({ notes })} multiline numberOfLines={2} />
            </View>
        </View>
    );
}
