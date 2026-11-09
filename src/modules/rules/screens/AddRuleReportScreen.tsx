import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Input, Button } from '../../../shared/components';
import { ruleService } from '../services/rule.service';
import { showToast } from '../../../shared/utils/toast';
import { dashboardEventsService } from '../../../shared/services/dashboard-events.service';
import { useLocation } from '../../../shared/contexts/LocationContext';
import { reportErrorFrom, showReportError } from '../../../shared/utils/reportErrors';
import { toReportHeading } from '../../../shared/utils/reportHeading';
import { showCampaignPointsEstimate } from '../../campaigns/utils/pointsPopup';
import { useScoringCampaign } from '../../campaigns/hooks/useScoringCampaign';
import { deviceFieldsFromFix, latestPhotoFix } from '../../../shared/utils/photoFix';
import { useTranslation } from 'react-i18next';
import { useUserLocation } from '../../map/hooks/useUserLocation';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { FONT_MEDIUM, RADIUS, RADIUS_SM, tint } from '../../campaigns/components/CampaignUi';
import { FieldLabel } from '../../../shared/components/FieldLabel';
import { isPunishableRule, NO_PUNISHMENT_VALUE } from '../utils/ruleTranslations';
import { PhotoPicker, UploadedPhoto } from '../../../shared/components/PhotoPicker';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { askForNotifications } from '../../../shared/services/notificationPermission';

export default function AddRuleReportScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const { colors: theme, isDark } = useTheme();
    const params = useLocalSearchParams();
    const { typeId, typeName, typeRawName, typeDescription, typeImg } = params;
    const showPunishment = isPunishableRule(typeRawName as string);
    const { selectedLocation, setSelectedLocation } = useLocation();
    const { userLocation } = useUserLocation();

    const isNavigating = params.isNavigating === 'true';
    // opened straight from the quick-report sheet: no rule list screen underneath
    const fromReportSheet = params.fromReportSheet === 'true';
    const navLat = parseFloat(params.lat as string);
    const navLng = parseFloat(params.lng as string);
    const navCoordinates = !isNaN(navLat) && !isNaN(navLng) ? { lat: navLat, lng: navLng } : null;
    const navHeading = toReportHeading(params.heading as string | undefined);

    const insets = useSafeAreaInsets();
    const [punishment, setPunishment] = useState('');
    const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(
        isNavigating ? navCoordinates ?? null : null
    );
    const [submitting, setSubmitting] = useState(false);
    const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
    const inCampaign = !!useScoringCampaign('traffic_rule');
    const [noPhotoPrompt, setNoPhotoPrompt] = useState(false);
    const [usingCurrentLocation, setUsingCurrentLocation] = useState(isNavigating && !!navCoordinates);

    const autoFilledLocation = React.useRef(false);

    React.useEffect(() => {
        if (autoFilledLocation.current || coordinates || !userLocation) return;
        autoFilledLocation.current = true;
        setCoordinates(userLocation);
        setUsingCurrentLocation(true);
    }, [coordinates, userLocation]);

    useFocusEffect(
        React.useCallback(() => {
            if (selectedLocation) {
                setCoordinates(selectedLocation);
                setUsingCurrentLocation(false);
                setSelectedLocation(null);
            }
        }, [selectedLocation, setSelectedLocation])
    );

    const handlePickLocation = () => {
        router.push('/rules/map-picker');
    };

    const handleUseCurrentLocation = () => {
        if (!userLocation) {
            showToast(`${t('location-unavailable')}: ${t('please-wait-for-location')}`);
            return;
        }

        setCoordinates(userLocation);
        setUsingCurrentLocation(true);
    };

    const handleSubmit = async (skipPhotoPrompt = false) => {
        if (!coordinates) {
            showToast(`${t('location-required')}: ${t('pick-location')}`);
            return;
        }

        // a photo is optional for rules, but it's worth more points, so nudge once before sending without one
        if (inCampaign && photos.length === 0 && !skipPhotoPrompt) {
            setNoPhotoPrompt(true);
            return;
        }

        const photoFix = latestPhotoFix(photos);
        setSubmitting(true);
        try {
            // heading only applies to the spot the driver reported from, not a map-picked one
            const atNavFix = coordinates.lat === navCoordinates?.lat && coordinates.lng === navCoordinates?.lng;
            const report = await ruleService.reportRule({
                lat: coordinates.lat,
                lng: coordinates.lng,
                typeId: typeId as string,
                punishment: (showPunishment && punishment.trim()) || NO_PUNISHMENT_VALUE,
                ...(atNavFix && navHeading !== undefined && { heading: navHeading }),
                ...(photos.length > 0 && { image: photos.map((photo) => photo.objectName) }),
                ...(photoFix && deviceFieldsFromFix(photoFix)),
            });

            dashboardEventsService.contribute();
            showToast(t(report.merged ? 'report-merged-thanks' : 'traffic-rule-report-submitted'));
            // "complete" for a rule = punishment filled plus a photo (backend's rule)
            const hasPhoto = photos.length > 0;
            const isComplete = hasPhoto && showPunishment && punishment.trim().length > 0;
            if (!report.merged) showCampaignPointsEstimate('traffic_rule', coordinates, { hasPhoto, isComplete });
            void askForNotifications('contribution');
            router.back();
            if (!fromReportSheet) router.back();
        } catch (error) {
            console.error('Submit error:', error);
            showReportError(t, reportErrorFrom(error));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <View className="flex-1" style={{ backgroundColor: theme.background }}>
            <View className="px-6 pb-2" style={{ paddingTop: insets.top + 12, backgroundColor: theme.background }}>
                <TouchableOpacity onPress={() => router.back()} className="self-start p-1 -ml-1" activeOpacity={0.7} hitSlop={8}>
                    <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
                </TouchableOpacity>
                <Text className="mt-3" style={{ color: theme.textPrimary, fontSize: 26, lineHeight: 32, letterSpacing: -0.4 }}>
                    {t('report-traffic-rule')}
                </Text>
            </View>

            <View className="mx-6 mt-3 mb-4 px-4 py-3" style={{ borderRadius: RADIUS, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }}>
                <View className="flex-row items-center">
                    <View className="w-12 h-12 items-center justify-center mr-3 overflow-hidden" style={{ borderRadius: RADIUS_SM, backgroundColor: isDark ? '#FFFFFF' : '#F3F4F6' }}>
                        {typeImg && typeof typeImg === 'string' && typeImg.length > 0 ? (
                            <Image
                                source={{ uri: typeImg }}
                                style={{ width: 40, height: 40 }}
                                resizeMode="contain"
                            />
                        ) : (
                            <Ionicons name="shield-checkmark" size={26} color="#EF4444" />
                        )}
                    </View>
                    <View className="flex-1">
                        <Text style={{ color: theme.textPrimary, fontFamily: FONT_MEDIUM, fontSize: 16 }}>{typeName || 'Traffic Rule'}</Text>
                        <Text className="text-xs mt-0.5" style={{ color: theme.textSecondary }} numberOfLines={2}>
                            {typeDescription || 'Report a traffic rule violation'}
                        </Text>
                    </View>
                </View>
            </View>

            <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false}>
                <View className="gap-5 pb-6">
                    {showPunishment && (
                        <View>
                            <FieldLabel label={t('punishment')} optional />
                            <Input
                                variant="calm"
                                placeholder={t('punishment-placeholder')}
                                value={punishment}
                                onChangeText={setPunishment}
                                multiline
                                numberOfLines={3}
                            />
                            <Text className="text-xs mt-1.5" style={{ color: theme.textSecondary }}>
                                {t('punishment-description')}
                            </Text>
                        </View>
                    )}

                    <View>
                        <FieldLabel label={t('location')} required />
                        {coordinates ? (
                            <View>
                                <View className="px-4 py-3" style={{ borderRadius: RADIUS, backgroundColor: theme.greenMuted, borderWidth: 1, borderColor: tint(theme.green, '66') }}>
                                    <View className="flex-row items-center justify-between">
                                        <Ionicons name="location" size={18} color={theme.green} style={{ marginRight: 10 }} />
                                        <View className="flex-1">
                                            <Text className="text-sm" style={{ color: theme.textPrimary, fontFamily: FONT_MEDIUM }}>
                                                {usingCurrentLocation ? t('current-location') : t('location-selected')}
                                            </Text>
                                            <Text className="text-xs mt-0.5" style={{ color: theme.textSecondary, fontVariant: ['tabular-nums'] }}>
                                                {coordinates.lat.toFixed(7)}, {coordinates.lng.toFixed(7)}
                                            </Text>
                                        </View>
                                        {!isNavigating && (
                                            <TouchableOpacity onPress={() => { setCoordinates(null); setUsingCurrentLocation(false); }}>
                                                <Ionicons name="close-circle" size={20} color={theme.textSecondary} />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </View>
                                {!isNavigating && (
                                    <>
                                        <View className="flex-row items-center justify-center my-2">
                                            <View className="flex-1 h-px" style={{ backgroundColor: theme.border }} />
                                            <Text className="text-xs mx-3" style={{ color: theme.textSecondary }}>{t('or')}</Text>
                                            <View className="flex-1 h-px" style={{ backgroundColor: theme.border }} />
                                        </View>
                                        <TouchableOpacity
                                            className="px-3 py-2.5 flex-row items-center justify-between"
                                            onPress={handlePickLocation}
                                            activeOpacity={0.7}
                                            style={{ borderRadius: RADIUS_SM, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }}
                                        >
                                            <View className="flex-row items-center flex-1">
                                                <View className="w-8 h-8 items-center justify-center" style={{ borderRadius: RADIUS_SM, backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border }}>
                                                    <Ionicons name="map-outline" size={16} color={theme.primary} />
                                                </View>
                                                <View className="ml-3 flex-1">
                                                    <Text className="text-sm" style={{ color: theme.textPrimary, fontFamily: FONT_MEDIUM }}>
                                                        {t('pick-location-on-map')}
                                                    </Text>
                                                </View>
                                            </View>
                                            <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
                                        </TouchableOpacity>
                                    </>
                                )}
                            </View>
                        ) : (
                            <View>
                                {!isNavigating && (
                                    <TouchableOpacity
                                        className="px-3 py-2.5 flex-row items-center justify-between mb-2"
                                        onPress={handlePickLocation}
                                        activeOpacity={0.7}
                                        style={{ borderRadius: RADIUS_SM, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }}
                                    >
                                        <View className="flex-row items-center flex-1">
                                            <View className="w-8 h-8 items-center justify-center" style={{ borderRadius: RADIUS_SM, backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border }}>
                                                <Ionicons name="map-outline" size={16} color={theme.primary} />
                                            </View>
                                            <View className="ml-3 flex-1">
                                                <Text className="text-sm" style={{ color: theme.textPrimary, fontFamily: FONT_MEDIUM }}>
                                                    {t('pick-location-on-map')}
                                                </Text>
                                            </View>
                                        </View>
                                        <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
                                    </TouchableOpacity>
                                )}
                                {!isNavigating && (
                                    <View className="flex-row items-center justify-center my-2">
                                        <View className="flex-1 h-px" style={{ backgroundColor: theme.border }} />
                                        <Text className="text-xs mx-3" style={{ color: theme.textSecondary }}>{t('or')}</Text>
                                        <View className="flex-1 h-px" style={{ backgroundColor: theme.border }} />
                                    </View>
                                )}
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
                            </View>
                        )}
                    </View>

                    <View>
                        <FieldLabel label={t('photos')} optional />
                        <PhotoPicker photos={photos} onChange={setPhotos} folder="rules" cameraOnly={inCampaign} requireLocation={inCampaign} />
                    </View>
                </View>
            </ScrollView>

            <View className="px-6 pt-3" style={{ paddingBottom: insets.bottom + 12, backgroundColor: theme.background, borderTopWidth: 1, borderTopColor: theme.border }}>
                <Button
                    style={{ borderRadius: RADIUS_SM, minHeight: 48, paddingVertical: 12 }}
                    textStyle={{ fontSize: 16, fontWeight: 'normal', fontFamily: FONT_MEDIUM }}
                    title={submitting ? t('submitting') : t('submit-report')}
                    onPress={() => void handleSubmit()}
                    disabled={submitting || !coordinates}
                />
            </View>

            <ConfirmDialog
                visible={noPhotoPrompt}
                title={t('campaign-no-photo-title')}
                message={t('campaign-rule-no-photo-message')}
                cancelLabel={t('add-photo')}
                confirmLabel={t('submit-anyway')}
                onCancel={() => setNoPhotoPrompt(false)}
                onConfirm={() => {
                    setNoPhotoPrompt(false);
                    void handleSubmit(true);
                }}
            />
        </View>
    );
}
