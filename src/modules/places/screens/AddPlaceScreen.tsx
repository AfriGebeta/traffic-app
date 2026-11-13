import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
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
import { isActive, pickLabel, usePlaceCatalog } from '../services/placeCatalog';
import { useIsDataCollector } from '../hooks/useIsDataCollector';
import { BusinessFields } from '../components/BusinessFields';
import { CollectorFields } from '../components/CollectorFields';
import { OfferEditor } from '../components/OfferEditor';
import { SelectField } from '../components/FormControls';
import { MAX_DESCRIPTION, MAX_FLOORS, STREET_LEVEL, buildBusiness, draftDescription, emptyBusinessDraft, offersAllowed, BusinessDraft } from '../utils/businessDraft';
import { setPendingBuilding, takePendingBuilding } from '../utils/pendingBuilding';
import { LabeledPhoto } from '../types/business.types';

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
    // opened from the business form's "+ Add a new building"
    const returnToBusiness = params.returnTo === 'business';
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
    const [campus, setCampus] = useState<string | null>(null);
    const [landmark, setLandmark] = useState('');
    const [businessDraft, setBusinessDraft] = useState<BusinessDraft>(emptyBusinessDraft);
    const patchBusiness = React.useCallback((patch: Partial<BusinessDraft>) => setBusinessDraft((prev) => ({ ...prev, ...patch })), []);
    const [buildingsVersion, setBuildingsVersion] = useState(0);
    // shop PIN returned after saving a business with a code offer
    const [savedPin, setSavedPin] = useState<{ placeId: string; pin: string } | null>(null);
    const isCollector = useIsDataCollector();
    const { catalog, failed: catalogFailed, retry: retryCatalog } = usePlaceCatalog();
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
    const isBusiness = placeType === 'business';
    // collectors: building needs kind, floors, campus and a front photo; business needs hours, description and photos
    const collectorBuilding = isCollector && isBuilding;
    const collectorPlace = isCollector && (isBusiness || isBuilding);
    const descriptionRequired = isCollector && isBusiness;
    const photosRequired = inCampaign || collectorPlace;
    const trimmedFloorCount = floorCount.trim();
    const takesMenu = MENU_TYPES.includes(placeType);
    const trimmedBlock = blockNumber.trim();
    // a block is a number, e.g. "12"
    const blockInvalid = isCondominium && !/^\d+$/.test(trimmedBlock);
    const trimmedPhone = phone.trim();
    const phoneE164 = trimmedPhone ? toE164(trimmedPhone) : null;
    const phoneInvalid = trimmedPhone.length > 0 && !phoneE164;
    const phoneMissing = isBusiness && !trimmedPhone;
    const buildingIncomplete = collectorBuilding && (!buildingKind || !trimmedFloorCount || !campus);
    const businessBlocked = isBusiness && (!catalog || !businessDraft.buildingChoice || !businessDraft.group || !businessDraft.kind);

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

    // back from "+ Add a new building": select it and refresh the nearby list
    useFocusEffect(
        React.useCallback(() => {
            if (!isBusiness) return;
            const building = takePendingBuilding();
            if (!building) return;
            patchBusiness({ buildingChoice: building.id, buildingName: building.name, buildingFloorCount: building.floorCount, floor: null });
            setBuildingsVersion((n) => n + 1);
        }, [isBusiness, patchBusiness])
    );

    const handleAddBuilding = () => {
        router.push({ pathname: '/places/add', params: { type: 'building', returnTo: 'business' } });
    };

    // collectors: first photo is the front, the rest get the type's second label (inside / main entrance)
    const labeledPhotos = (): LabeledPhoto[] => {
        const types = catalog?.photoTypes[isBuilding ? 'building' : 'business'] ?? [];
        const rest = types.find((type) => type.key !== 'front')?.key ?? 'front';
        return images.map((img, index) => ({ key: img.objectName, type: index === 0 ? 'front' : rest }));
    };

    const writeDescriptionDraft = () => {
        const group = catalog?.businessGroups.find((g) => g.key === businessDraft.group);
        const kind = group?.kinds.find((k) => k.key === businessDraft.kind);
        const floor = businessDraft.floor ? (businessDraft.floor === 'ground' ? 'ground floor' : businessDraft.floor === 'basement' ? 'basement' : `floor ${businessDraft.floor}`) : '';
        const where =
            businessDraft.buildingChoice === STREET_LEVEL
                ? businessDraft.landmark.trim() ? `Near ${businessDraft.landmark.trim()}` : ''
                : [floor && floor[0].toUpperCase() + floor.slice(1), businessDraft.buildingName && `of ${businessDraft.buildingName}`, businessDraft.unit.trim() && `office ${businessDraft.unit.trim()}`]
                      .filter(Boolean)
                      .join(' ');
        const feature = group?.features.find((f) => businessDraft.features.includes(f.key));
        setDescription(
            draftDescription({
                kindLabel: pickLabel(kind?.label, 'en', 'Business'),
                products: businessDraft.products,
                where,
                feature: feature ? pickLabel(feature.label, 'en') : undefined,
            })
        );
    };

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

        if (phoneMissing) {
            showToast(t('business-phone-required'));
            return;
        }

        let business: ReturnType<typeof buildBusiness>['business'] | undefined;
        if (isBusiness) {
            if (!catalog) {
                showToast(t('business-catalog-unavailable'));
                return;
            }
            const built = buildBusiness(businessDraft, isCollector, catalog);
            if (built.missing.length > 0) {
                showToast(`${t('please-fill')}: ${built.missing.map((key) => t(key)).join(', ')}`);
                return;
            }
            business = built.business;
        }

        if (buildingIncomplete) {
            showToast(`${t('please-fill')}: ${[!buildingKind && t('building-kind'), !trimmedFloorCount && t('floor-count'), !campus && t('campus-area')].filter(Boolean).join(', ')}`);
            return;
        }

        if (descriptionRequired && !description.trim()) {
            showToast(`${t('please-fill')}: ${t('description')}`);
            return;
        }

        if (collectorPlace && images.length === 0) {
            showToast(t('collector-photo-required'));
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
                landmarkDescription: collectorBuilding && landmark.trim() ? landmark.trim() : undefined,
            };
            const hasAddress = Boolean(address.city || address.neighborhood || address.streetName || address.blockNumber || address.landmarkDescription);

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
                // collectors label their business/building photos; everyone else sends plain keys
                ...(collectorPlace ? { photos: labeledPhotos() } : { images: images.map((img) => img.objectName) }),
                ...(takesMenu && menuPhotos.length > 0 && { menu: menuPhotos.map((photo) => photo.objectName) }),
                ...(isBuilding && trimmedFloorCount && { floorCount: trimmedFloorCount }),
                ...(isBuilding && buildingKind && { buildingKind }),
                ...(collectorBuilding && campus && { campus }),
                ...(business && { business }),
                address: hasAddress ? address : undefined,
                // the photo's fix is where the user stood; otherwise the live location
                ...(photoFix ? deviceFieldsFromFix(photoFix) : userLocation && { deviceLat: userLocation.lat, deviceLng: userLocation.lng }),
            };
            // TEMP: check what the backend receives
            console.log(`[place-submit] type=${placeType} slug=${slugForType(placeType)}`, JSON.stringify(request, null, 2));
            const created: any = await placeService.contributePlace(request);
            const createdPlace = created?.data?.id ? created.data : created;
            // TEMP: what the backend saved
            console.log('[place-created]', JSON.stringify({ id: createdPlace?.id, status: createdPlace?.status, collectionStatus: createdPlace?.collectionStatus, business: !!createdPlace?.business, offerPin: !!createdPlace?.offerPin }));

            dashboardEventsService.contribute();
            showToast(t('place-contribution-submitted'));
            showCampaignPointsEstimate('place', coordinates, { hasPhoto: images.length > 0, category: slugForType(placeType) });
            void askForNotifications('contribution');

            // hand the new building back to the business form, one screen back
            if (isBuilding && returnToBusiness && createdPlace?.id) {
                setPendingBuilding({ id: createdPlace.id, name: name.trim(), floorCount: trimmedFloorCount || null });
                router.back();
                return;
            }

            // a code offer: show the shop PIN before leaving
            const pin = createdPlace?.offerPin ?? createdPlace?.business?.offerPin;
            if (isBusiness && pin) {
                setSavedPin({ placeId: createdPlace.id, pin: String(pin) });
                return;
            }

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
            // 400 E0007: additional.missing / additional.invalid name the fields
            const additional = error instanceof ApiError ? error.additional : undefined;
            const fields = [...(Array.isArray(additional?.missing) ? additional.missing : []), ...(Array.isArray(additional?.invalid) ? additional.invalid : [])];
            if (fields.length > 0) {
                const named = fields.map((field: unknown) => (typeof field === 'string' ? field : (field as any)?.field ?? JSON.stringify(field)));
                showToast(`${t('please-check')}: ${named.join(', ')}`);
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
                            <FieldLabel label={t('building-kind')} required={collectorBuilding} optional={!collectorBuilding} />
                            <SelectField
                                title={t('building-kind')}
                                placeholder={t('building-kind-placeholder')}
                                options={
                                    catalog?.buildingKinds.length
                                        ? catalog.buildingKinds.filter(isActive).map((kind) => ({ value: kind.key, label: pickLabel(kind.label, i18n.language, kind.key) }))
                                        : BUILDING_KINDS.map((kind) => ({ value: kind as string, label: t(`building-kind-${kind}`) }))
                                }
                                value={buildingKind}
                                onChange={(kind) => setBuildingKind(kind as BuildingKind | null)}
                                clearable={!collectorBuilding}
                            />
                        </View>
                    )}

                    {isBuilding && (
                        <View>
                            <FieldLabel label={t('floor-count')} required={collectorBuilding} optional={!collectorBuilding} />
                            {collectorBuilding ? (
                                // collectors pick 1 to 20; normal users type any number
                                <SelectField
                                    title={t('floor-count')}
                                    placeholder={t('choose')}
                                    options={Array.from({ length: MAX_FLOORS }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))}
                                    value={trimmedFloorCount || null}
                                    onChange={(count) => setFloorCount(count ?? '')}
                                />
                            ) : (
                                <Input
                                    variant="calm"
                                    placeholder={t('floor-count-placeholder')}
                                    value={floorCount}
                                    // digits only
                                    onChangeText={(text) => setFloorCount(text.replace(/\D/g, ''))}
                                    keyboardType="number-pad"
                                    maxLength={3}
                                />
                            )}
                        </View>
                    )}

                    {collectorBuilding && (
                        <View>
                            <FieldLabel label={t('campus-area')} required />
                            <SelectField
                                title={t('campus-area')}
                                placeholder={t('choose')}
                                options={(catalog?.campusAreas ?? []).filter(isActive).map((c) => ({ value: c.key, label: pickLabel(c.label, i18n.language, c.key) }))}
                                value={campus}
                                onChange={setCampus}
                            />
                        </View>
                    )}

                    {collectorBuilding && (
                        <View>
                            <FieldLabel label={t('nearest-landmark')} optional />
                            <Input variant="calm" placeholder={t('nearest-landmark-placeholder')} value={landmark} onChangeText={setLandmark} />
                        </View>
                    )}

                    {isBusiness && !catalog && (
                        <View className="flex-row items-center px-4 py-3" style={{ borderRadius: RADIUS, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface }}>
                            <Text className="flex-1 text-sm" style={{ color: theme.textSecondary }}>
                                {catalogFailed ? t('business-catalog-unavailable') : t('loading')}
                            </Text>
                            {catalogFailed && (
                                <TouchableOpacity onPress={retryCatalog} hitSlop={8}>
                                    <Text className="text-sm" style={{ color: theme.primary, fontFamily: FONT_MEDIUM }}>{t('retry')}</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    )}

                    {isBusiness && catalog && (
                        <BusinessFields
                            draft={businessDraft}
                            onChange={patchBusiness}
                            catalog={catalog}
                            isCollector={isCollector}
                            coordinates={coordinates}
                            onAddBuilding={handleAddBuilding}
                            buildingsVersion={buildingsVersion}
                        />
                    )}

                    <View>
                        <FieldLabel label={t('phone-number')} required={isBusiness} optional={!isBusiness} />
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

                    {isBusiness && (
                        <View>
                            <FieldLabel label={t('second-phone')} optional />
                            <Input
                                variant="calm"
                                placeholder={t('place-phone-placeholder')}
                                value={businessDraft.phone2}
                                onChangeText={(phone2) => patchBusiness({ phone2 })}
                                keyboardType="phone-pad"
                            />
                        </View>
                    )}

                    {isBusiness && isCollector && (
                        <View>
                            <FieldLabel label={t('business-telegram')} optional hint={t('business-telegram-hint')} />
                            <Input
                                variant="calm"
                                placeholder="@username"
                                value={businessDraft.telegram}
                                onChangeText={(telegram) => patchBusiness({ telegram })}
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                        </View>
                    )}

                    <View>
                        <FieldLabel
                            label={t('description')}
                            required={descriptionRequired}
                            optional={!descriptionRequired}
                            hint={isBusiness ? catalog?.businessGroups.find((g) => g.key === businessDraft.group)?.descriptionExample : undefined}
                        />
                        <Input
                            variant="calm"
                            placeholder={t('add-details-about-place')}
                            value={description}
                            onChangeText={setDescription}
                            multiline
                            numberOfLines={3}
                            maxLength={isBusiness ? MAX_DESCRIPTION : undefined}
                        />
                        {isBusiness && (
                            <View className="flex-row items-center justify-between mt-1.5">
                                <TouchableOpacity onPress={writeDescriptionDraft} disabled={!businessDraft.kind} hitSlop={6}>
                                    <Text className="text-sm" style={{ color: businessDraft.kind ? theme.primary : theme.textSecondary, fontFamily: FONT_MEDIUM }}>
                                        {t('write-description-draft')}
                                    </Text>
                                </TouchableOpacity>
                                <Text className="text-xs" style={{ color: theme.textSecondary, fontVariant: ['tabular-nums'] }}>
                                    {description.length}/{MAX_DESCRIPTION}
                                </Text>
                            </View>
                        )}
                    </View>

                    {isBusiness && isCollector && catalog && (
                        <View>
                            <Text className="mb-3" style={{ color: theme.textPrimary, fontFamily: FONT_MEDIUM, fontSize: 16 }}>{t('collector-details')}</Text>
                            <CollectorFields draft={businessDraft} onChange={patchBusiness} catalog={catalog} />
                        </View>
                    )}

                    {isBusiness && isCollector && catalog && !!businessDraft.kind && (
                        <View>
                            <Text style={{ color: theme.textPrimary, fontFamily: FONT_MEDIUM, fontSize: 16 }}>{t('trial-offers')}</Text>
                            {offersAllowed(businessDraft, catalog) ? (
                                <>
                                    <Text className="text-xs mt-0.5 mb-3" style={{ color: theme.textSecondary }}>{t('trial-offers-hint')}</Text>
                                    <OfferEditor draft={businessDraft} onChange={patchBusiness} catalog={catalog} placeName={name} description={description} />
                                </>
                            ) : (
                                <Text className="text-sm mt-1" style={{ color: theme.textSecondary }}>{t('mapped-without-offers')}</Text>
                            )}
                        </View>
                    )}

                    {!isBusiness && (
                        <View>
                            <FieldLabel label={t('city')} optional />
                            <Input variant="calm" placeholder={t('city-placeholder')} value={city} onChangeText={setCity} />
                        </View>
                    )}

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

                    {!isBusiness && (
                        <View>
                            <FieldLabel label={t('neighborhood')} optional />
                            <Input variant="calm" placeholder={t('neighborhood-placeholder')} value={neighborhood} onChangeText={setNeighborhood} />
                        </View>
                    )}

                    {!isBusiness && (
                        <View>
                            <FieldLabel label={t('street-name')} optional />
                            <Input variant="calm" placeholder={t('street-name-placeholder')} value={streetName} onChangeText={setStreetName} />
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
                        {/* campaigns and collectors need a photo, so don't call it optional there */}
                        <FieldLabel
                            label={t('photos')}
                            required={collectorPlace}
                            optional={!photosRequired}
                            hint={collectorPlace ? t('collector-photos-hint') : undefined}
                        />
                        <PhotoPicker photos={images} onChange={setImages} folder="places" cameraOnly={inCampaign} requireLocation={inCampaign} />
                    </View>
                </View>
            </ScrollView>

            <View className="px-6 pt-3" style={{ paddingBottom: insets.bottom + 12, backgroundColor: theme.background, borderTopWidth: 1, borderTopColor: theme.border }}>
                <Button
                    style={{ borderRadius: RADIUS_SM, minHeight: 48, paddingVertical: 12 }}
                    textStyle={{ fontSize: 16, fontWeight: 'normal', fontFamily: FONT_MEDIUM }}
                    title={submitting ? t('submitting') : t('submit-contribution')}
                    onPress={() => void handleSubmit()}
                    disabled={submitting || !name.trim() || !coordinates || phoneInvalid || blockInvalid || phoneMissing || businessBlocked || (needsCustomCategory && !customCategory.trim())}
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

            <ConfirmDialog
                visible={savedPin !== null}
                title={t('shop-pin')}
                message={t('shop-pin-saved', { pin: savedPin?.pin ?? '' })}
                confirmLabel={t('done')}
                onConfirm={() => {
                    setSavedPin(null);
                    leaveScreen();
                }}
                onCancel={() => {
                    setSavedPin(null);
                    leaveScreen();
                }}
            />
        </View>
    );
}
