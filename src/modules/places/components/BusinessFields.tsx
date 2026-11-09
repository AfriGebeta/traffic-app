import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Input } from '../../../shared/components';
import { FieldLabel } from '../../../shared/components/FieldLabel';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { colors } from '../../../shared/theme/colors';
import { FONT_MEDIUM, RADIUS_SM } from '../../campaigns/components/CampaignUi';
import { businessService } from '../services/business.service';
import { isActive, pickLabel } from '../services/placeCatalog';
import { DAY_KEYS, NearbyBuilding, PlaceCatalog } from '../types/business.types';
import { ADD_BUILDING, BusinessDraft, CUSTOM_HOURS, STREET_LEVEL, floorValues } from '../utils/businessDraft';
import { SelectField, SelectOption } from './FormControls';

interface Props {
    draft: BusinessDraft;
    onChange: (patch: Partial<BusinessDraft>) => void;
    catalog: PlaceCatalog;
    isCollector: boolean;
    coordinates: { lat: number; lng: number } | null;
    onAddBuilding: () => void;
    // bump to reload nearby buildings (after adding one)
    buildingsVersion: number;
}

const floorLabel = (floor: string, t: (key: string, opts?: any) => string) =>
    floor === 'basement' ? t('floor-basement') : floor === 'ground' ? t('floor-ground') : t('floor-n', { floor });

export function BusinessFields({ draft, onChange, catalog, isCollector, coordinates, onAddBuilding, buildingsVersion }: Props) {
    const { t, i18n } = useTranslation();
    const { colors: theme, isDark } = useTheme();
    const lang = i18n.language;
    const [buildings, setBuildings] = useState<NearbyBuilding[] | null>(null);
    const [loadingBuildings, setLoadingBuildings] = useState(false);

    // nearby buildings follow the pin, rounded so small moves don't refetch
    const latKey = coordinates ? coordinates.lat.toFixed(3) : null;
    const lngKey = coordinates ? coordinates.lng.toFixed(3) : null;
    useEffect(() => {
        if (!coordinates) return;
        let alive = true;
        setLoadingBuildings(true);
        businessService
            .nearbyBuildings(coordinates.lat, coordinates.lng)
            .then((rows) => alive && setBuildings(rows))
            .catch(() => alive && setBuildings((prev) => prev ?? []))
            .finally(() => alive && setLoadingBuildings(false));
        return () => {
            alive = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [latKey, lngKey, buildingsVersion]);

    const streetLevel = draft.buildingChoice === STREET_LEVEL;
    const inBuilding = !!draft.buildingChoice && !streetLevel;

    const buildingOptions: SelectOption[] = [
        ...(buildings ?? []).map((b) => ({
            value: b.id,
            label: pickLabel(b.name as any, lang, t('unnamed-building')),
            hint: [`${Math.round(b.distanceM)} m`, b.floorCount ? t('floors-count', { count: Number(b.floorCount) }) : null, /pend/i.test(b.status ?? '') ? t('pending') : null]
                .filter(Boolean)
                .join(' · '),
        })),
        // the building just added may not be in the nearby list yet
        ...(inBuilding && !(buildings ?? []).some((b) => b.id === draft.buildingChoice)
            ? [{ value: draft.buildingChoice as string, label: draft.buildingName || t('new-building') }]
            : []),
        { value: STREET_LEVEL, label: t('not-in-building'), sticky: true, icon: 'storefront-outline' as const },
        { value: ADD_BUILDING, label: t('add-new-building'), accent: true, sticky: true, icon: 'add' as const },
    ];

    const chooseBuilding = (value: string | null) => {
        if (value === ADD_BUILDING) {
            onAddBuilding();
            return;
        }
        if (value === STREET_LEVEL || !value) {
            onChange({ buildingChoice: value, buildingName: '', buildingFloorCount: null, floor: null, unit: '' });
            return;
        }
        const building = buildings?.find((b) => b.id === value);
        onChange({
            buildingChoice: value,
            buildingName: building ? pickLabel(building.name as any, lang) : draft.buildingName,
            buildingFloorCount: building ? building.floorCount : draft.buildingFloorCount,
            floor: null,
            landmark: '',
            campus: null,
        });
    };

    const groups = catalog.businessGroups.filter(isActive);
    const group = groups.find((g) => g.key === draft.group);
    const kinds = (group?.kinds ?? []).filter(isActive);

    const setDay = (day: (typeof DAY_KEYS)[number], patch: Partial<BusinessDraft['customHours'][typeof day]>) =>
        onChange({ customHours: { ...draft.customHours, [day]: { ...draft.customHours[day], ...patch } } });

    const copyMonday = () =>
        onChange({ customHours: Object.fromEntries(DAY_KEYS.map((day) => [day, { ...draft.customHours.mon }])) as BusinessDraft['customHours'] });

    const timeInputStyle = {
        flex: 1,
        minHeight: 40,
        borderRadius: RADIUS_SM,
        borderWidth: 1,
        borderColor: theme.border,
        backgroundColor: isDark ? theme.surface : colors.gray[50],
        color: theme.textPrimary,
        paddingHorizontal: 10,
        fontSize: 14,
        textAlign: 'center' as const,
    };

    return (
        <View className="gap-5">
            <View>
                <FieldLabel label={t('business-building')} required hint={!coordinates ? t('business-building-needs-location') : undefined} />
                <SelectField
                    title={t('business-building')}
                    placeholder={loadingBuildings && !buildings ? t('loading') : t('choose')}
                    options={buildingOptions}
                    value={draft.buildingChoice}
                    onChange={chooseBuilding}
                    searchPlaceholder={t('search-building')}
                    emptyText={t('no-building-match')}
                />
                {loadingBuildings && !!buildings && (
                    <View className="flex-row items-center mt-1.5">
                        <ActivityIndicator size="small" color={theme.textSecondary} />
                        <Text className="text-xs ml-1.5" style={{ color: theme.textSecondary }}>{t('loading')}</Text>
                    </View>
                )}
            </View>

            {inBuilding && (
                <View className="flex-row gap-3">
                    <View className="flex-1">
                        <FieldLabel label={t('business-floor')} required />
                        <SelectField
                            title={t('business-floor')}
                            placeholder={t('choose')}
                            options={floorValues(draft.buildingFloorCount).map((floor) => ({ value: floor, label: floorLabel(floor, t) }))}
                            value={draft.floor}
                            onChange={(floor) => onChange({ floor })}
                        />
                    </View>
                    <View className="flex-1">
                        <FieldLabel label={t('business-unit')} optional />
                        <Input variant="calm" placeholder={t('business-unit-placeholder')} value={draft.unit} onChangeText={(unit) => onChange({ unit })} />
                    </View>
                </View>
            )}

            {streetLevel && (
                <View>
                    <FieldLabel label={t('nearest-landmark')} optional />
                    <Input variant="calm" placeholder={t('nearest-landmark-placeholder')} value={draft.landmark} onChangeText={(landmark) => onChange({ landmark })} />
                </View>
            )}

            {streetLevel && isCollector && (
                <View>
                    <FieldLabel label={t('campus-area')} required />
                    <SelectField
                        title={t('campus-area')}
                        placeholder={t('choose')}
                        options={catalog.campusAreas.filter(isActive).map((c) => ({ value: c.key, label: pickLabel(c.label, lang, c.key) }))}
                        value={draft.campus}
                        onChange={(campus) => onChange({ campus })}
                    />
                </View>
            )}

            <View>
                <FieldLabel label={t('business-group')} required />
                <SelectField
                    title={t('business-group')}
                    placeholder={t('choose')}
                    options={groups.map((g) => ({ value: g.key, label: pickLabel(g.label, lang, g.key) }))}
                    value={draft.group}
                    // kind, products and features belong to the group
                    onChange={(next) => next !== draft.group && onChange({ group: next, kind: null, products: [], features: [], offers: [] })}
                />
            </View>

            {!!group && (
                <View>
                    <FieldLabel label={t('business-kind')} required />
                    <SelectField
                        title={t('business-kind')}
                        placeholder={t('choose')}
                        options={kinds.map((k) => ({ value: k.key, label: pickLabel(k.label, lang, k.key) }))}
                        value={draft.kind}
                        onChange={(kind) => onChange({ kind })}
                        searchPlaceholder={kinds.length > 8 ? t('search') : undefined}
                        emptyText={t('no-results')}
                    />
                </View>
            )}

            <View>
                <FieldLabel label={t('opening-hours')} required={isCollector} optional={!isCollector} />
                <SelectField
                    title={t('opening-hours')}
                    placeholder={t('choose')}
                    options={catalog.hoursPresets.map((p) => ({ value: p.key, label: pickLabel(p.label, lang, p.key) }))}
                    value={draft.hoursPreset}
                    onChange={(hoursPreset) => onChange({ hoursPreset })}
                    clearable={!isCollector}
                />
                {draft.hoursPreset === CUSTOM_HOURS && (
                    <View className="mt-3 gap-2">
                        {DAY_KEYS.map((day) => {
                            const entry = draft.customHours[day];
                            return (
                                <View key={day} className="flex-row items-center gap-2">
                                    <Text style={{ width: 40, color: theme.textPrimary, fontFamily: FONT_MEDIUM, fontSize: 13 }}>{t(`day-${day}`)}</Text>
                                    {entry.closed ? (
                                        <Text className="flex-1 text-sm" style={{ color: theme.textSecondary }}>{t('closed')}</Text>
                                    ) : (
                                        <>
                                            <TextInput
                                                style={timeInputStyle}
                                                placeholder="07:00"
                                                placeholderTextColor={theme.textSecondary}
                                                value={entry.open}
                                                onChangeText={(open) => setDay(day, { open })}
                                                keyboardType="numbers-and-punctuation"
                                                maxLength={5}
                                            />
                                            <Text style={{ color: theme.textSecondary }}>–</Text>
                                            <TextInput
                                                style={timeInputStyle}
                                                placeholder="21:00"
                                                placeholderTextColor={theme.textSecondary}
                                                value={entry.close}
                                                onChangeText={(close) => setDay(day, { close })}
                                                keyboardType="numbers-and-punctuation"
                                                maxLength={5}
                                            />
                                        </>
                                    )}
                                    <TouchableOpacity onPress={() => setDay(day, { closed: !entry.closed })} hitSlop={6} className="px-2 py-1.5">
                                        <Text className="text-xs" style={{ color: entry.closed ? theme.primary : theme.textSecondary, fontFamily: FONT_MEDIUM }}>
                                            {entry.closed ? t('open') : t('closed')}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            );
                        })}
                        <TouchableOpacity onPress={copyMonday} className="self-start mt-1" hitSlop={6}>
                            <Text className="text-sm" style={{ color: theme.primary, fontFamily: FONT_MEDIUM }}>{t('copy-monday-to-all')}</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        </View>
    );
}
