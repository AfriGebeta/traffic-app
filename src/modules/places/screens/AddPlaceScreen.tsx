import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal, Pressable } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Input, Button } from '../../../shared/components';
import { BUILDING_KINDS, BuildingKind, PLACE_TYPES, PlaceContributionAddress, PlaceType } from '../types/place.types';
import { categoryIdFor, loadPlaceCategories, slugForType, usePlaceCategories } from '../services/placeCategories';
import { placeService } from '../services/place.service';
import { showToast } from '../../../shared/utils/toast';
import { useLocation } from '../../../shared/contexts/LocationContext';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { dashboardEventsService } from '../../../shared/services/dashboard-events.service';
import { useUserLocation } from '../../map/hooks/useUserLocation';
import { colors } from '../../../shared/theme/colors';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { getPlaceIcon } from '../utils/placeIcons';
import { toE164 } from '../../../shared/utils/phone';
import { getPlaceTranslationKey } from '../utils/placeTranslations';
import { PhotoPicker, UploadedPhoto } from '../../../shared/components/PhotoPicker';
import { useScoringCampaign } from '../../campaigns/hooks/useScoringCampaign';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { ApiError, ApiErrorCode, getCampaignFailures, getDuplicatePlaceNames, isRestrictedError } from '../../../shared/utils/apiErrors';
import { showCampaignPointsEstimate } from '../../campaigns/utils/pointsPopup';
import { PHOTO_PIN_LIMIT_M, deviceFieldsFromFix, latestPhotoFix, photoPinGap } from '../../../shared/utils/photoFix';
import { askForNotifications } from '../../../shared/services/notificationPermission';
import { FONT_MEDIUM, RADIUS, RADIUS_SM, tint } from '../../campaigns/components/CampaignUi';
import { FieldLabel } from '../../../shared/components/FieldLabel';

// types the backend accepts menu photos for (others answer 400 E0007)
const MENU_TYPES: PlaceType[] = ['restaurant', 'cafe', 'hotel'];
const MAX_MENU_PHOTOS = 10;

export default function AddPlaceScreen() {
    const { t, i18n } = useTranslation();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { colors: theme, isDark } = useTheme();
    const params = useLocalSearchParams();
    const placeType = params.type as PlaceType;
    const { selectedLocation, setSelectedLocation } = useLocation();
    const { userLocation } = useUserLocation();

    const prefillName = typeof params.prefillName === 'string' ? params.prefillName : '';
    const prefillCategory = typeof params.prefillCategory === 'string' ? params.prefillCategory : '';
    const prefillDescription = typeof params.prefillDescription === 'string' ? params.prefillDescription : '';
    const prefillPhone = typeof params.prefillPhone === 'string' ? params.prefillPhone : '';
    const backSteps = Math.max(1, Number(params.backSteps) || 1);
    const prefillLat = Number(params.prefillLat);
    const prefillLng = Number(params.prefillLng);
    const prefillCoordinates =
        Number.isFinite(prefillLat) && Number.isFinite(prefillLng) && params.prefillLat !== undefined
            ? { lat: prefillLat, lng: prefillLng }
            : null;

    const [name, setName] = useState(prefillName);
    const [customCategory, setCustomCategory] = useState(prefillCategory);
    const [description, setDescription] = useState(prefillDescription);
    const [phone, setPhone] = useState(prefillPhone);
    const [city, setCity] = useState('');
    const [neighborhood, setNeighborhood] = useState('');
    const [streetName, setStreetName] = useState('');
    const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(prefillCoordinates);
    const inCampaign = !!useScoringCampaign('place');
    const [images, setImages] = useState<UploadedPhoto[]>([]);
    const [menuPhotos, setMenuPhotos] = useState<UploadedPhoto[]>([]);
    const [blockNumber, setBlockNumber] = useState('');
    const [floorCount, setFloorCount] = useState('');
    const [buildingKind, setBuildingKind] = useState<BuildingKind | null>(null);
    const [buildingKindOpen, setBuildingKindOpen] = useState(false);
    const categories = usePlaceCategories();
    const [submitting, setSubmitting] = useState(false);
    // E0016: names of similar places nearby; null when the dialog is closed
    const [duplicateNames, setDuplicateNames] = useState<string[] | null>(null);
    const [usingCurrentLocation, setUsingCurrentLocation] = useState(false);
    const [pinFromPhoto, setPinFromPhoto] = useState(false);
    const autoFilledLocation = React.useRef(Boolean(prefillCoordinates));

    const placeInfo = PLACE_TYPES.find((p) => p.id === placeType);
    const needsCustomCategory = placeType === 'other';
    const isCondominium = placeType === 'condominium';
    const isBuilding = placeType === 'building';
    const trimmedFloorCount = floorCount.trim();
    const takesMenu = MENU_TYPES.includes(placeType);
    const trimmedBlock = blockNumber.trim();
    // a block is a number, e.g. "12"
    const blockInvalid = isCondominium && !/^\d+$/.test(trimmedBlock);
    const trimmedPhone = phone.trim();
    const phoneE164 = trimmedPhone ? toE164(trimmedPhone) : null;
    const phoneInvalid = trimmedPhone.length > 0 && !phoneE164;

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
                setPinFromPhoto(false);
                setSelectedLocation(null);
            }
        }, [selectedLocation, setSelectedLocation])
    );

    // a new photo moves the pin to where it was taken, unless the user placed the pin on the map
    const photoFix = latestPhotoFix(images);
    const photoFixTime = photoFix?.timestamp;
    React.useEffect(() => {
        if (!photoFix || (coordinates && !usingCurrentLocation && !pinFromPhoto)) return;
        setCoordinates({ lat: photoFix.lat, lng: photoFix.lng });
        setUsingCurrentLocation(false);
        setPinFromPhoto(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [photoFixTime]);
    const pinGap = inCampaign ? photoPinGap(coordinates, photoFix, PHOTO_PIN_LIMIT_M.place) : null;


    const handlePickLocation = () => {
        router.push('/places/map-picker');
    };

    const handleUseCurrentLocation = () => {
        if (!userLocation) {
            showToast(t('please-wait-for-location'));
            return;
        }

        setCoordinates(userLocation);
        setUsingCurrentLocation(true);
        setPinFromPhoto(false);
    };

    const leaveScreen = () => {
        for (let i = 0; i < backSteps && router.canGoBack(); i += 1) {
            router.back();
        }
    };

    const handleSubmit = async () => {
        if (!name.trim()) {
            showToast(`${t('name-required')}: ${t('please-enter-place-name')}`);
            return;
        }

        if (!coordinates) {
            showToast(`${t('location-required')}: ${t('please-pick-location')}`);
            return;
        }

        if (needsCustomCategory && !customCategory.trim()) {
            showToast(`${t('category-required')}: ${t('please-enter-place-category')}`);
            return;
        }

        if (phoneInvalid) {
            showToast(t('invalid-phone-number'));
            return;
        }

        if (blockInvalid) {
            showToast(t('block-number-required'));
            return;
        }

        // the list may still be loading (or failed earlier); try once more before giving up
        const categoryId = categoryIdFor(placeType, categories ?? (await loadPlaceCategories()));
        if (!categoryId) {
            showToast(t('place-category-unavailable'));
            return;
        }

        // campaigns only accept places with a photo
        if (inCampaign && images.length === 0) {
            showToast(t('campaign-photo-required'));
            return;
        }

        setSubmitting(true);
        try {
            const trimmedDescription = description.trim();
            const trimmedCustomCategory = customCategory.trim();
            const address: PlaceContributionAddress = {
                city: city.trim() || undefined,
                neighborhood: neighborhood.trim() || undefined,
                streetName: streetName.trim() || undefined,
                blockNumber: isCondominium ? trimmedBlock : undefined,
            };
            const hasAddress = Boolean(address.city || address.neighborhood || address.streetName || address.blockNumber);

            const request = {
                name: name.trim(),
                categoryId,
                lat: coordinates.lat,
                lng: coordinates.lng,
                // "other" has no backend category - keep the user's label in the description
                description: needsCustomCategory
                    ? [trimmedCustomCategory, trimmedDescription].filter(Boolean).join(' - ')
                    : trimmedDescription,
                phone: phoneE164 ?? undefined,
                images: images.map((img) => img.objectName),
                ...(takesMenu && menuPhotos.length > 0 && { menu: menuPhotos.map((photo) => photo.objectName) }),
                ...(isBuilding && trimmedFloorCount && { floorCount: trimmedFloorCount }),
                ...(isBuilding && buildingKind && { buildingKind }),
                address: hasAddress ? address : undefined,
                // the photo's fix is where the user stood; otherwise the live location
                ...(photoFix ? deviceFieldsFromFix(photoFix) : userLocation && { deviceLat: userLocation.lat, deviceLng: userLocation.lng }),
            };
            // TEMP: check what the backend receives
            console.log(`[place-submit] type=${placeType} slug=${slugForType(placeType)}`, JSON.stringify(request, null, 2));
            await placeService.contributePlace(request);

            dashboardEventsService.contribute();
            showToast(t('place-contribution-submitted'));
            showCampaignPointsEstimate('place', coordinates, { hasPhoto: images.length > 0, category: slugForType(placeType) });
            void askForNotifications('contribution');

            leaveScreen();
        } catch (error) {
            console.error('Submit error:', error);
            const code = error instanceof ApiError ? error.code : undefined;
            if (isRestrictedError(code)) return;
            if (code === ApiErrorCode.DuplicatePlace) {
                setDuplicateNames(getDuplicatePlaceNames((error as ApiError).additional, i18n.language));
                return;
            }
            if (code === ApiErrorCode.PhotoLocationMismatch) {
                showToast(t('photo-location-mismatch'));
                return;
            }
            if (code === ApiErrorCode.CampaignRulesNotMet) {
                const failures = getCampaignFailures((error as ApiError).additional);
                showToast(failures.length > 0 ? failures.join('\n') : t('campaign-rules-not-met'));
                return;
            }
            const errorMessage = error instanceof Error ? error.message : t('could-not-submit-contribution');
            showToast(errorMessage);
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
                    {t('add-place-details')}
                </Text>
            </View>

            <View
                className="mx-6 mt-3 mb-4 px-4 py-3 flex-row items-center"
                style={{ borderRadius: RADIUS, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }}
            >
                <View className="w-10 h-10 items-center justify-center mr-3">
                    {(() => {
                        const Icon = getPlaceIcon(placeType, isDark);

                        return <Icon width={32} height={32} />;
                    })()}
                </View>
                <View className="flex-1">
                    <Text style={{ color: theme.textPrimary, fontFamily: FONT_MEDIUM, fontSize: 16 }}>
                        {needsCustomCategory && customCategory.trim()
                            ? customCategory.trim()
                            : placeType ? t(getPlaceTranslationKey(placeType)) : placeInfo?.label}
                    </Text>
                    <Text className="text-xs mt-0.5" style={{ color: theme.textSecondary }}>{t('fill-in-the-details')}</Text>
                </View>
            </View>

            <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false}>
                <View className="gap-5 pb-6">

                    <View>
                        <FieldLabel label={t('place-name')} required />
                        <Input variant="calm" placeholder={t('place-name-placeholder')} value={name} onChangeText={setName} />
                    </View>

                    {needsCustomCategory && (
                        <View>
                            <FieldLabel label={t('place-category')} required />
                            <Input
                                variant="calm"
                                placeholder={t('place-category-placeholder')}
                                value={customCategory}
                                onChangeText={setCustomCategory}
                            />
                            <Text className="text-xs mt-1.5" style={{ color: theme.textSecondary }}>
                                {t('place-category-hint')}
                            </Text>
                        </View>
                    )}

                    {isCondominium && (
                        <View>
                            <FieldLabel label={t('block-number')} required />
                            <Input
                                variant="calm"
                                placeholder={t('block-number-placeholder')}
                                value={blockNumber}
                                // digits only
                                onChangeText={(text) => setBlockNumber(text.replace(/\D/g, ''))}
                                keyboardType="number-pad"
                                maxLength={6}
                            />
                        </View>
                    )}

                    {isBuilding && (
                        <View>
                            <FieldLabel label={t('building-kind')} optional />
                            <TouchableOpacity
                                onPress={() => setBuildingKindOpen(true)}
                                activeOpacity={0.7}
                                className="flex-row items-center border px-3.5"
                                style={{ borderRadius: RADIUS_SM, minHeight: 48, borderColor: theme.border, backgroundColor: isDark ? theme.surface : colors.gray[50] }}
                            >
                                <Text
                                    className="flex-1"
                                    style={{ fontSize: 15, color: buildingKind ? theme.textPrimary : theme.textSecondary }}
                                    numberOfLines={1}
                                >
                                    {buildingKind ? t(`building-kind-${buildingKind}`) : t('building-kind-placeholder')}
                                </Text>
                                <Ionicons name="chevron-down" size={18} color={theme.textSecondary} />
                            </TouchableOpacity>
                        </View>
                    )}

                    {isBuilding && (
                        <View>
                            <FieldLabel label={t('floor-count')} optional />
                            <Input
                                variant="calm"
                                placeholder={t('floor-count-placeholder')}
                                value={floorCount}
                                // digits only
                                onChangeText={(text) => setFloorCount(text.replace(/\D/g, ''))}
                                keyboardType="number-pad"
                                maxLength={3}
                            />
                        </View>
                    )}

                    <View>
                        <FieldLabel label={t('phone-number')} optional />
                        <Input
                            variant="calm"
                            placeholder={t('place-phone-placeholder')}
                            value={phone}
                            onChangeText={setPhone}
                            keyboardType="phone-pad"
                            autoComplete="tel"
                            error={phoneInvalid ? t('invalid-phone-number') : undefined}
                        />
                    </View>

                    <View>
                        <FieldLabel label={t('description')} optional />
                        <Input
                            variant="calm"
                            placeholder={t('add-details-about-place')}
                            value={description}
                            onChangeText={setDescription}
                            multiline
                            numberOfLines={3}
                        />
                    </View>

                    <View>
                        <FieldLabel label={t('city')} optional />
                        <Input variant="calm" placeholder={t('city-placeholder')} value={city} onChangeText={setCity} />
                    </View>

                    {takesMenu && (
                        <View>
                            <FieldLabel label={t('menu-photos')} optional hint={t('menu-photos-hint', { max: MAX_MENU_PHOTOS })} />
                            {/* no GPS needed and gallery allowed: menus are often shot indoors or saved earlier */}
                            <PhotoPicker
                                photos={menuPhotos}
                                onChange={(next) => setMenuPhotos(next.slice(0, MAX_MENU_PHOTOS))}
                                folder="places"
                                size="small"
                            />
                        </View>
                    )}

                    <View>
                        <FieldLabel label={t('neighborhood')} optional />
                        <Input variant="calm" placeholder={t('neighborhood-placeholder')} value={neighborhood} onChangeText={setNeighborhood} />
                    </View>

                    <View>
                        <FieldLabel label={t('street-name')} optional />
                        <Input variant="calm" placeholder={t('street-name-placeholder')} value={streetName} onChangeText={setStreetName} />
                    </View>

                    <View>
                        <FieldLabel label={t('location')} required />
                        {coordinates ? (
                            <View>
                                <View className="px-4 py-3" style={{ borderRadius: RADIUS, backgroundColor: theme.greenMuted, borderWidth: 1, borderColor: tint(theme.green, '66') }}>
                                    <View className="flex-row items-center justify-between">
                                        <Ionicons name="location" size={18} color={theme.green} style={{ marginRight: 10 }} />
                                        <View className="flex-1">
                                            <Text className="text-sm" style={{ color: theme.textPrimary, fontFamily: FONT_MEDIUM }}>
                                                {pinFromPhoto ? t('photo-location') : usingCurrentLocation ? t('current-location') : t('location-selected')}
                                            </Text>
                                            <Text className="text-xs mt-0.5" style={{ color: theme.textSecondary, fontVariant: ['tabular-nums'] }}>
                                                {coordinates.lat.toFixed(7)}, {coordinates.lng.toFixed(7)}
                                            </Text>
                                        </View>
                                        <TouchableOpacity
                                            onPress={() => { setCoordinates(null); setUsingCurrentLocation(false); setPinFromPhoto(false); }}
                                            hitSlop={8}
                                        >
                                            <Ionicons name="close-circle" size={20} color={theme.textSecondary} />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                                {pinGap != null && (
                                    <Text className="text-xs mt-2" style={{ color: theme.error }}>
                                        {t('photo-pin-too-far', { distance: pinGap, limit: PHOTO_PIN_LIMIT_M.place })}
                                    </Text>
                                )}
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
                            </View>
                        ) : (
                            <View>
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
                                <View className="flex-row items-center justify-center my-2">
                                    <View className="flex-1 h-px" style={{ backgroundColor: theme.border }} />
                                    <Text className="text-xs mx-3" style={{ color: theme.textSecondary }}>{t('or')}</Text>
                                    <View className="flex-1 h-px" style={{ backgroundColor: theme.border }} />
                                </View>
                                <TouchableOpacity
                                    className="flex-row items-center justify-center"
                                    style={{ height: 46, borderRadius: RADIUS_SM, backgroundColor: theme.primary, opacity: userLocation ? 1 : 0.5 }}
                                    onPress={handleUseCurrentLocation}
                                    activeOpacity={0.7}
                                    disabled={!userLocation}
                                >
                                    <Ionicons name="locate" size={18} color="white" />
                                    <Text className="ml-2" style={{ color: '#fff', fontFamily: FONT_MEDIUM, fontSize: 15 }}>
                                        {t('use-current-location')}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>

                    <View>
                        {/* campaigns reject places without a photo, so don't call it optional there */}
                        <FieldLabel label={t('photos')} optional={!inCampaign} />
                        <PhotoPicker photos={images} onChange={setImages} folder="places" requireLocation={inCampaign} />
                    </View>
                </View>
            </ScrollView>

            <View className="px-6 pt-3" style={{ paddingBottom: insets.bottom + 12, backgroundColor: theme.background, borderTopWidth: 1, borderTopColor: theme.border }}>
                <Button
                    style={{ borderRadius: RADIUS_SM, minHeight: 48, paddingVertical: 12 }}
                    textStyle={{ fontSize: 16, fontWeight: 'normal', fontFamily: FONT_MEDIUM }}
                    title={submitting ? t('submitting') : t('submit-contribution')}
                    onPress={() => void handleSubmit()}
                    disabled={submitting || !name.trim() || !coordinates || phoneInvalid || blockInvalid || (needsCustomCategory && !customCategory.trim())}
                />
            </View>

            <ConfirmDialog
                visible={duplicateNames !== null}
                title={t('similar-place-title')}
                message={[t('similar-place-exists'), ...(duplicateNames ?? []).map((n) => `• ${n}`)].join('\n')}
                cancelLabel={t('edit')}
                confirmLabel={t('done')}
                onCancel={() => setDuplicateNames(null)}
                onConfirm={() => {
                    setDuplicateNames(null);
                    leaveScreen();
                }}
            />

            <Modal visible={buildingKindOpen} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setBuildingKindOpen(false)}>
                <Pressable
                    className="flex-1 items-center justify-center px-6"
                    style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
                    onPress={() => setBuildingKindOpen(false)}
                >
                    <Pressable className="w-full py-2" style={{ borderRadius: RADIUS, backgroundColor: theme.background, maxWidth: 480, borderWidth: 1, borderColor: theme.border }}>
                        <Text className="px-5 pt-3 pb-2" style={{ color: theme.textPrimary, fontFamily: FONT_MEDIUM, fontSize: 16 }}>
                            {t('building-kind')}
                        </Text>
                        <ScrollView style={{ maxHeight: 420 }}>
                            {BUILDING_KINDS.map((kind) => {
                                const selected = kind === buildingKind;
                                return (
                                    <TouchableOpacity
                                        key={kind}
                                        onPress={() => {
                                            // tapping the chosen one again clears it (the field is optional)
                                            setBuildingKind(selected ? null : kind);
                                            setBuildingKindOpen(false);
                                        }}
                                        className="flex-row items-center px-5 py-3.5"
                                    >
                                        <Text className="flex-1 text-sm" style={{ color: theme.textPrimary, fontFamily: selected ? FONT_MEDIUM : undefined }}>
                                            {t(`building-kind-${kind}`)}
                                        </Text>
                                        {selected && <Ionicons name="checkmark" size={18} color={theme.primary} />}
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </Pressable>
                </Pressable>
            </Modal>
        </View>
    );
}
