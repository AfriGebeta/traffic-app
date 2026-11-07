import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Input, Button } from '../../../shared/components';
import { showToast } from '../../../shared/utils/toast';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUserLocation } from '../../map/hooks/useUserLocation';
import { useNeighborhoodContribution } from '../hooks/useNeighborhoodContribution';
import { dashboardEventsService } from '../../../shared/services/dashboard-events.service';
import { BoundingBox } from '../types/neighborhood.types';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { FONT_MEDIUM, RADIUS, RADIUS_SM } from '../../campaigns/components/CampaignUi';
import { FieldLabel } from '../../../shared/components/FieldLabel';
import { useLocalSearchParams } from 'expo-router';

export default function NeighborhoodContributionScreen() {
    const { t } = useTranslation();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { colors: theme } = useTheme();
    const params = useLocalSearchParams();
    const { userLocation } = useUserLocation();
    const { contributeNeighborhood, loading } = useNeighborhoodContribution();

    const [name, setName] = useState('');
    const [slug, setSlug] = useState('');
    const [description, setDescription] = useState('');
    const [city, setCity] = useState('');
    const [subcity, setSubcity] = useState('');
    const [woreda, setWoreda] = useState('');
    const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);
    const [boundingBox, setBoundingBox] = useState<BoundingBox | null>(null);
    const [usingCurrentLocation, setUsingCurrentLocation] = useState(false);

    useFocusEffect(
        React.useCallback(() => {
            if (params.savedBoundingBox) {
                try {
                    const box = JSON.parse(params.savedBoundingBox as string);
                    setBoundingBox(box);
                    router.setParams({ savedBoundingBox: undefined });
                } catch (error) {
                    console.error('failed to parse bounding box:', error);
                }
            }
        }, [params.savedBoundingBox])
    );

    const handleNameChange = (value: string) => {
        setName(value);
        const generatedSlug = value
            .toLowerCase()
            .trim()
            .replace(/\s+/g, '-')
            .replace(/[^\w\-]+/g, '');
        setSlug(generatedSlug);
    };

    const handleUseCurrentLocation = () => {
        if (!userLocation) {
            showToast(`${t('location-unavailable')}: ${t('please-wait-for-location')}`);
            return;
        }

        setCoordinates(userLocation);
        setUsingCurrentLocation(true);
    };

    const handleSubmit = async () => {
        if (!name.trim()) {
            showToast(`${t('name-required')}: ${t('please-enter-neighborhood-name')}`);
            return;
        }

        if (!slug.trim()) {
            showToast(`${t('slug-required')}: ${t('please-enter-slug')}`);
            return;
        }

        if (!coordinates) {
            showToast(`${t('location-required')}: ${t('please-pick-location')}`);
            return;
        }

        try {
            const contributionData = {
                name: name.trim(),
                slug: slug.trim(),
                description: description.trim() || undefined,
                lat: coordinates.lat,
                lng: coordinates.lng,
                boundingBox: boundingBox || undefined,
                city: city.trim() || undefined,
                subcity: subcity.trim() || undefined,
                woreda: woreda.trim() || undefined,
                verified: false,
            };

            await contributeNeighborhood(contributionData);

            dashboardEventsService.contribute();
            showToast(t('neighborhood-contribution-submitted'));
            router.back();
        } catch (error) {
            console.error('Submit error:', error);
            const errorMessage = error instanceof Error ? error.message : t('could-not-submit-contribution');
            showToast(errorMessage);
        }
    };

    return (
        <View className="flex-1" style={{ backgroundColor: theme.background }}>
            <View className="px-6 pb-2" style={{ paddingTop: insets.top + 12, backgroundColor: theme.background }}>
                <TouchableOpacity onPress={() => router.back()} className="self-start p-1 -ml-1" activeOpacity={0.7} hitSlop={8}>
                    <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
                </TouchableOpacity>
                <Text className="mt-3" style={{ color: theme.textPrimary, fontSize: 26, lineHeight: 32, letterSpacing: -0.4 }}>
                    {t('add-neighborhood')}
                </Text>
            </View>

            <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false}>
                <View className="gap-5 pb-6 mt-4">
                    <View>
                        <FieldLabel label={t('neighborhood-name')} required />
                        <Input
                            variant="calm"
                            placeholder={t('neighborhood-name-placeholder')}
                            value={name}
                            onChangeText={handleNameChange}
                        />
                    </View>

                    <View>
                        <FieldLabel label={t('slug')} required />
                        <Input
                            variant="calm"
                            placeholder={t('slug-placeholder')}
                            value={slug}
                            onChangeText={setSlug}
                        />
                        <Text className="text-xs mt-1.5" style={{ color: theme.textSecondary }}>{t('auto-generated-from-name')}</Text>
                    </View>

                    <View>
                        <FieldLabel label={t('description')} />
                        <Input
                            variant="calm"
                            placeholder={t('add-details-about-neighborhood')}
                            value={description}
                            onChangeText={setDescription}
                            multiline
                            numberOfLines={3}
                        />
                    </View>

                    <View>
                        <FieldLabel label={t('location')} required />
                        {coordinates ? (
                            <View className="px-4 py-3" style={{ borderRadius: RADIUS, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }}>
                                <View className="flex-row items-center justify-between">
                                    <Ionicons name="location" size={18} color={theme.primary} style={{ marginRight: 10 }} />
                                    <View className="flex-1">
                                        <Text className="text-sm" style={{ color: theme.textPrimary, fontFamily: FONT_MEDIUM }}>
                                            {usingCurrentLocation ? t('current-location') : t('location-selected')}
                                        </Text>
                                        <Text className="text-xs mt-0.5" style={{ color: theme.textSecondary, fontVariant: ['tabular-nums'] }}>
                                            {coordinates.lat.toFixed(7)}, {coordinates.lng.toFixed(7)}
                                        </Text>
                                    </View>
                                    <TouchableOpacity onPress={() => { setCoordinates(null); setUsingCurrentLocation(false); }} hitSlop={8}>
                                        <Ionicons name="close-circle" size={20} color={theme.textSecondary} />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ) : (
                            <TouchableOpacity
                                className="flex-row items-center justify-center"
                                style={{ height: 46, borderRadius: RADIUS_SM, backgroundColor: theme.primary, opacity: userLocation ? 1 : 0.5 }}
                                onPress={handleUseCurrentLocation}
                                activeOpacity={0.7}
                                disabled={!userLocation}
                            >
                                <Ionicons name="locate" size={18} color="white" />
                                <Text className="ml-2" style={{ color: '#fff', fontFamily: FONT_MEDIUM, fontSize: 15 }}>{t('use-current-location')}</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    <View>
                        <FieldLabel label={t('city')} />
                        <Input
                            variant="calm"
                            placeholder={t('city-placeholder')}
                            value={city}
                            onChangeText={setCity}
                        />
                    </View>

                    <View>
                        <FieldLabel label={t('subcity')} />
                        <Input
                            variant="calm"
                            placeholder={t('subcity-placeholder')}
                            value={subcity}
                            onChangeText={setSubcity}
                        />
                    </View>

                    <View>
                        <FieldLabel label={t('woreda')} />
                        <Input
                            variant="calm"
                            placeholder={t('woreda-placeholder')}
                            value={woreda}
                            onChangeText={setWoreda}
                        />
                    </View>

                    <View>
                        <FieldLabel label={t('bounding-box-optional')} />
                        <TouchableOpacity
                            className="px-3 py-2.5 flex-row items-center justify-between"
                            style={{ borderRadius: RADIUS_SM, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }}
                            onPress={() => {
                                const centerCoords = coordinates || { lat: 9.0105, lng: 38.7636 };
                                router.push({
                                    pathname: '/neighborhoods/bounding-box',
                                    params: {
                                        boundingBox: boundingBox ? JSON.stringify(boundingBox) : '',
                                        lat: centerCoords.lat.toString(),
                                        lng: centerCoords.lng.toString(),
                                    }
                                });
                            }}
                            activeOpacity={0.7}
                        >
                            <View className="flex-row items-center flex-1">
                                <View className="w-8 h-8 items-center justify-center" style={{ borderRadius: RADIUS_SM, backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border }}>
                                    <Ionicons name="resize-outline" size={16} color={boundingBox ? theme.primary : theme.textSecondary} />
                                </View>
                                <View className="ml-3 flex-1">
                                    <Text className="text-sm" style={{ color: theme.textPrimary, fontFamily: FONT_MEDIUM }}>
                                        {boundingBox ? t('edit-bounding-box') : t('draw-bounding-box')}
                                    </Text>
                                    {boundingBox && (
                                        <Text className="text-xs mt-0.5" style={{ color: theme.textSecondary }}>{t('bounding-box-set')}</Text>
                                    )}
                                </View>
                            </View>
                            <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
                        </TouchableOpacity>

                        {boundingBox && (
                            <View className="mt-2 p-3" style={{ borderRadius: RADIUS_SM, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }}>
                                <Text className="text-xs mb-2" style={{ color: theme.textPrimary, fontFamily: FONT_MEDIUM }}>{t('bounding-box-coordinates')}</Text>
                                <View className="gap-1">
                                    <Text className="text-xs" style={{ color: theme.textSecondary, fontVariant: ['tabular-nums'] }}>
                                        {t('north')}: {boundingBox.north.toFixed(6)}
                                    </Text>
                                    <Text className="text-xs" style={{ color: theme.textSecondary, fontVariant: ['tabular-nums'] }}>
                                        {t('south')}: {boundingBox.south.toFixed(6)}
                                    </Text>
                                    <Text className="text-xs" style={{ color: theme.textSecondary, fontVariant: ['tabular-nums'] }}>
                                        {t('east')}: {boundingBox.east.toFixed(6)}
                                    </Text>
                                    <Text className="text-xs" style={{ color: theme.textSecondary, fontVariant: ['tabular-nums'] }}>
                                        {t('west')}: {boundingBox.west.toFixed(6)}
                                    </Text>
                                </View>
                            </View>
                        )}
                    </View>
                </View>
            </ScrollView>

            <View className="px-6 pt-3" style={{ paddingBottom: insets.bottom + 12, backgroundColor: theme.background, borderTopWidth: 1, borderTopColor: theme.border }}>
                <Button
                    style={{ borderRadius: RADIUS_SM, minHeight: 48, paddingVertical: 12 }}
                    textStyle={{ fontSize: 16, fontWeight: 'normal', fontFamily: FONT_MEDIUM }}
                    title={loading ? t('submitting') : t('submit-contribution')}
                    onPress={handleSubmit}
                    disabled={loading || !name.trim() || !slug.trim() || !coordinates}
                />
            </View>
        </View>
    );
}
