import React, { useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    TextInput,
    Animated,
    Easing,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { Audio } from 'expo-av';
import { useLocation } from '../../../shared/contexts/LocationContext';
import { colors } from '../../../shared/theme/colors';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { useTranslation } from '../../../shared/hooks/useTranslation';
import { showToast } from '../../../shared/utils/toast';
import { useVoiceRecording } from '../../navigation/hooks/useVoiceRecording';
import { placeService } from '../services/place.service';
import { markHomeOnboardingDone } from '../utils/homeOnboarding';
import {
    HOME_ADDRESS_REQUIRED_FIELDS,
    HomeAddressRequiredField,
    SavedPlaceAddress,
} from '../types/place.types';

type Step = 'choice' | 'followup' | 'form';

const hlog = (...args: any[]) => console.log('home addr', ...args);

const MIC_SIZE = 128;

function MicGlow({ active }: { active: boolean }) {
    const outerAnim = useRef(new Animated.Value(0)).current;
    const innerAnim = useRef(new Animated.Value(0)).current;
    const loopsRef = useRef<Animated.CompositeAnimation[]>([]);

    useEffect(() => {
        loopsRef.current.forEach(loop => loop.stop());
        loopsRef.current = [];

        if (!active) {
            Animated.parallel([
                Animated.timing(outerAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
                Animated.timing(innerAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
            ]).start();
            return;
        }

        outerAnim.setValue(0);
        innerAnim.setValue(0);

        const pulse = (anim: Animated.Value, delay: number, duration: number) =>
            Animated.loop(
                Animated.sequence([
                    Animated.timing(anim, {
                        toValue: 1,
                        duration,
                        delay,
                        easing: Easing.out(Easing.ease),
                        useNativeDriver: true,
                    }),
                    Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
                ])
            );

        const outerLoop = pulse(outerAnim, 0, 1100);
        const innerLoop = pulse(innerAnim, 350, 1100);
        loopsRef.current = [outerLoop, innerLoop];
        outerLoop.start();
        innerLoop.start();

        return () => {
            loopsRef.current.forEach(loop => loop.stop());
            loopsRef.current = [];
        };
    }, [active]);

    const outerScale = outerAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 3.2] });
    const outerOpacity = outerAnim.interpolate({ inputRange: [0, 0.15, 0.6, 1], outputRange: [0, 0.3, 0.12, 0] });
    const innerScale = innerAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] });
    const innerOpacity = innerAnim.interpolate({ inputRange: [0, 0.15, 0.6, 1], outputRange: [0, 0.35, 0.15, 0] });

    return (
        <>
            <Animated.View
                pointerEvents="none"
                style={{
                    position: 'absolute',
                    width: MIC_SIZE,
                    height: MIC_SIZE,
                    borderRadius: MIC_SIZE / 2,
                    backgroundColor: colors.primary.main,
                    opacity: outerOpacity,
                    transform: [{ scale: outerScale }],
                }}
            />
            <Animated.View
                pointerEvents="none"
                style={{
                    position: 'absolute',
                    width: MIC_SIZE,
                    height: MIC_SIZE,
                    borderRadius: MIC_SIZE / 2,
                    backgroundColor: colors.primary.main,
                    opacity: innerOpacity,
                    transform: [{ scale: innerScale }],
                }}
            />
        </>
    );
}

const FIELD_LABEL_KEYS: Record<HomeAddressRequiredField, string> = {
    region: 'region',
    city: 'city',
    subCity: 'subcity',
    woreda: 'woreda',
    sefer: 'sefer',
};

export const AddHomeAddressScreen = () => {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { t } = useTranslation();
    const { colors: theme } = useTheme();

    const { isRecording, startRecording, stopRecording, cancelRecording } = useVoiceRecording();

    const [step, setStep] = useState<Step>('choice');
    const [saving, setSaving] = useState(false);
    const [missingFields, setMissingFields] = useState<HomeAddressRequiredField[]>([]);
    const [savedPlaceId, setSavedPlaceId] = useState<string | null>(null);
    const [capturedAddress, setCapturedAddress] = useState<SavedPlaceAddress>({});

    const [label, setLabel] = useState('');
    const [country, setCountry] = useState('');
    const [region, setRegion] = useState('');
    const [city, setCity] = useState('');
    const [subCity, setSubCity] = useState('');
    const [woreda, setWoreda] = useState('');
    const [sefer, setSefer] = useState('');
    const [houseNumber, setHouseNumber] = useState('');
    const [floor, setFloor] = useState('');
    const [buildingTotalFloor, setBuildingTotalFloor] = useState('');
    const [pickedCoords, setPickedCoords] = useState<{ lat: number; lng: number } | null>(null);
    const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
    const [coordsSource, setCoordsSource] = useState<'current' | 'picked'>('current');

    const gpsCoordsRef = useRef<{ lat: number; lng: number } | null>(null);
    const { selectedLocation, setSelectedLocation } = useLocation();

    useFocusEffect(
        React.useCallback(() => {
            if (selectedLocation) {
                hlog('map picker returned coords:', selectedLocation);
                setPickedCoords(selectedLocation);
                setCoordsSource('picked');
                setSelectedLocation(null);
                delete (globalThis as any).__mapPickerData;
            }
        }, [selectedLocation, setSelectedLocation])
    );

    const getCoords = () =>
        coordsSource === 'picked' && pickedCoords ? pickedCoords : gpsCoordsRef.current;

    useEffect(() => {
        let cancelled = false;

        const fetchLocation = async () => {
            try {
                const { status } = await Location.getForegroundPermissionsAsync();
                hlog('location permission status:', status);
                if (status !== 'granted') return;

                const applyCoords = (coords: { latitude: number; longitude: number }, source: string) => {
                    if (cancelled) return;
                    const value = { lat: coords.latitude, lng: coords.longitude };
                    hlog(`gps fix (${source}):`, value);
                    gpsCoordsRef.current = value;
                    setGpsCoords(value);
                };

                const lastKnown = await Location.getLastKnownPositionAsync();
                if (lastKnown) applyCoords(lastKnown.coords, 'last known');
                else hlog('no last known position');

                const current = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.Balanced,
                });
                if (current) applyCoords(current.coords, 'current');
            } catch (error) {
                hlog('gps fetch failed:', String(error));
            }
        };

        hlog('screen mounted');
        fetchLocation();

        Audio.requestPermissionsAsync()
            .then(({ status }) => hlog('mic permission requested at mount:', status))
            .catch((error) => hlog('mic permission request failed:', String(error)));

        return () => {
            hlog('screen unmounted');
            cancelled = true;
            cancelRecording();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const finish = async () => {
        hlog('flow complete, navigating home');
        await markHomeOnboardingDone();
        showToast.success(t('home-address-saved'));
        router.replace('/');
    };

    const handleSkip = () => {
        hlog(`skipped (step: ${step})`);
        router.replace('/');
    };

    const stopAndSaveVoice = async () => {
        const audioUri = await stopRecording();
        hlog('recording stopped, uri:', audioUri);
        if (!audioUri) return;

        setSaving(true);
        try {
            const { data: saved, missingFields: missing } = savedPlaceId
                ? await placeService.updateSavedPlaceWithAudio(savedPlaceId, audioUri)
                : await placeService.savePlaceWithAudio({
                    type: 'HOME',
                    label: t('home'),
                    lat: getCoords()?.lat,
                    lng: getCoords()?.lng,
                    isPrivate: true,
                    audioUri,
                });

            hlog('voice save response, missing fields:', missing);
            if (missing.length === 0) {
                await finish();
                return;
            }

            setSavedPlaceId(saved.id);
            setCapturedAddress(saved);
            setMissingFields(missing);
            setStep('followup');
        } catch (error) {
            hlog('voice save failed:', String(error));
            showToast.error(t('error'), error instanceof Error ? error.message : t('failed-to-save-place'));
        } finally {
            setSaving(false);
        }
    };

    const PUSH_TO_TALK_THRESHOLD_MS = 350;
    const pressStartRef = useRef<number | null>(null);
    const startedThisPressRef = useRef(false);

    const handleMicPressIn = async () => {
        if (saving || isRecording) return;

        pressStartRef.current = Date.now();
        startedThisPressRef.current = true;
        hlog('mic pressed in, starting recording (coords:', getCoords(), ')');
        const started = await startRecording();
        hlog('recording started:', started);
        if (!started) startedThisPressRef.current = false;
    };

    const handleMicPressOut = async () => {
        if (saving || !isRecording) return;

        if (startedThisPressRef.current) {
            const heldMs = pressStartRef.current ? Date.now() - pressStartRef.current : 0;
            startedThisPressRef.current = false;
            pressStartRef.current = null;

            if (heldMs < PUSH_TO_TALK_THRESHOLD_MS) {
                hlog(`quick tap (${heldMs}ms) — staying in toggle mode`);
                return;
            }

            hlog(`held ${heldMs}ms — push-to-talk release, stopping`);
            await stopAndSaveVoice();
            return;
        }

        hlog('second tap — stopping toggle-mode recording');
        await stopAndSaveVoice();
    };

    const handleTypeInstead = () => {
        hlog('switched to typed form');
        if (isRecording) cancelRecording();
        setStep('form');
    };

    const handleFormSubmit = async () => {
        if (!region.trim() || !city.trim() || !subCity.trim() || !woreda.trim() || !sefer.trim()) {
            hlog('form submit blocked, required field empty');
            showToast.error(t('fill-required-fields'));
            return;
        }

        hlog(`form submit (coords source: ${coordsSource}, coords:`, getCoords(), ')');
        setSaving(true);
        try {
            const payload = {
                type: 'HOME' as const,
                label: label.trim() || t('home'),
                lat: getCoords()?.lat,
                lng: getCoords()?.lng,
                isPrivate: true,
                country: country.trim() || 'Ethiopia',
                region: region.trim(),
                city: city.trim(),
                subCity: subCity.trim(),
                woreda: woreda.trim(),
                sefer: sefer.trim(),
                houseNumber: houseNumber.trim() || undefined,
                floor: floor.trim() ? parseInt(floor, 10) : undefined,
                buildingTotalFloor: buildingTotalFloor.trim() ? parseInt(buildingTotalFloor, 10) : undefined,
            };
            if (savedPlaceId) {
                await placeService.updateSavedPlace(savedPlaceId, payload);
            } else {
                await placeService.savePlace(payload);
            }
            await finish();
        } catch (error) {
            hlog('form save failed:', String(error));
            showToast.error(t('error'), error instanceof Error ? error.message : t('failed-to-save-place'));
        } finally {
            setSaving(false);
        }
    };

    const renderInput = (
        labelText: string,
        value: string,
        onChangeText: (text: string) => void,
        placeholder?: string,
        keyboardType: 'default' | 'number-pad' = 'default'
    ) => (
        <View className="mb-4">
            <Text className="text-sm font-semibold mb-2" style={{ color: theme.textPrimary }}>
                {labelText}
            </Text>
            <TextInput
                className="rounded-xl px-4 py-3.5 text-base"
                style={{
                    backgroundColor: theme.surface,
                    borderWidth: 1,
                    borderColor: theme.border,
                    color: theme.textPrimary,
                }}
                placeholder={placeholder}
                placeholderTextColor={theme.textSecondary}
                value={value}
                onChangeText={onChangeText}
                keyboardType={keyboardType}
                editable={!saving}
            />
        </View>
    );

    const renderMicButton = () => (
        <View className="flex-1 items-center justify-center">
            <View style={{ width: MIC_SIZE, height: MIC_SIZE, alignItems: 'center', justifyContent: 'center' }}>
                <MicGlow active={isRecording} />
                <TouchableOpacity
                    onPressIn={handleMicPressIn}
                    onPressOut={handleMicPressOut}
                    activeOpacity={0.8}
                    disabled={saving}
                    className="items-center justify-center rounded-full"
                    style={{
                        width: MIC_SIZE,
                        height: MIC_SIZE,
                        backgroundColor: 'transparent',
                        borderWidth: 1,
                        borderColor: colors.primary.main,
                        opacity: saving ? 0.6 : 1,
                    }}
                >
                    {saving ? (
                        <ActivityIndicator size="large" color={colors.primary.main} />
                    ) : (
                        <Ionicons
                            name={isRecording ? 'stop' : 'mic-outline'}
                            size={48}
                            color={colors.primary.main}
                        />
                    )}
                </TouchableOpacity>
            </View>
            <Text className="text-base mt-6" style={{ color: theme.textPrimary }}>
                {isRecording ? t('tap-to-stop') : t('tap-or-hold-to-speak')}
            </Text>
        </View>
    );

    const renderChoice = () => (
        <View className="flex-1 px-6">
            <Text className="text-3xl font-bold mb-3" style={{ color: theme.textPrimary }}>
                {t('add-saved-place')}
            </Text>
            <Text className="text-base leading-6" style={{ color: theme.textSecondary }}>
                {t('add-home-desc')}
            </Text>

            {renderMicButton()}

            <TouchableOpacity
                onPress={handleTypeInstead}
                disabled={saving}
                activeOpacity={0.8}
                className="rounded-xl py-4 items-center"
                style={{ borderWidth: 1, borderColor: theme.border }}
            >
                <Text className="text-base font-semibold" style={{ color: theme.textPrimary }}>
                    {t('type-it-instead')}
                </Text>
            </TouchableOpacity>
        </View>
    );

    const renderFollowup = () => (
        <View className="flex-1 px-6">
            <Text className="text-2xl font-bold mb-3" style={{ color: theme.textPrimary }}>
                {t('missing-address-title')}
            </Text>
            <Text className="text-base leading-6 mb-4" style={{ color: theme.textSecondary }}>
                {t('missing-address-record-again')}
            </Text>

            <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                {HOME_ADDRESS_REQUIRED_FIELDS.map(field => {
                    const isMissing = missingFields.includes(field);
                    const capturedValue = capturedAddress[field];
                    return (
                        <View
                            key={field}
                            className="flex-row items-center px-3 py-1.5"
                            style={{
                                borderWidth: 1,
                                borderRadius: 6,
                                borderColor: isMissing ? theme.error : theme.textSecondary,
                                backgroundColor: 'transparent',
                            }}
                        >
                            <Ionicons
                                name={isMissing ? 'alert-circle' : 'checkmark-circle'}
                                size={16}
                                color={isMissing ? theme.error : theme.textSecondary}
                            />
                            <Text
                                className="text-sm ml-1.5"
                                style={{
                                    color: isMissing ? theme.error : theme.textSecondary,
                                    fontWeight: isMissing ? '700' : '400',
                                }}
                            >
                                {t(FIELD_LABEL_KEYS[field])}
                                {!isMissing && capturedValue ? `: ${capturedValue}` : ''}
                            </Text>
                        </View>
                    );
                })}
            </View>

            {renderMicButton()}

            <TouchableOpacity
                onPress={handleTypeInstead}
                disabled={saving}
                activeOpacity={0.8}
                className="rounded-xl py-4 items-center"
                style={{ borderWidth: 1, borderColor: theme.border }}
            >
                <Text className="text-base font-semibold" style={{ color: theme.textPrimary }}>
                    {t('type-it-instead')}
                </Text>
            </TouchableOpacity>
        </View>
    );

    const renderForm = () => (
        <ScrollView className="flex-1 px-6" keyboardShouldPersistTaps="handled">
            <Text className="text-2xl font-bold mb-6" style={{ color: theme.textPrimary }}>
                {t('add-saved-place')}
            </Text>

            <View className="mb-4">
                <TouchableOpacity
                    onPress={() => setCoordsSource('current')}
                    disabled={saving}
                    activeOpacity={0.8}
                    className="flex-row items-center rounded-xl px-4 py-3.5 mb-2"
                    style={{
                        borderWidth: 1,
                        borderColor: coordsSource === 'current' ? colors.primary.main : theme.border,
                        backgroundColor: coordsSource === 'current' ? theme.primaryMuted : 'transparent',
                    }}
                >
                    <Ionicons
                        name={coordsSource === 'current' ? 'radio-button-on' : 'radio-button-off'}
                        size={22}
                        color={coordsSource === 'current' ? colors.primary.main : theme.textSecondary}
                    />
                    <View className="ml-3 flex-1">
                        <Text className="text-base font-semibold" style={{ color: theme.textPrimary }}>
                            {t('use-current-location')}
                        </Text>
                        <Text className="text-xs mt-0.5" style={{ color: theme.textSecondary }}>
                            {gpsCoords
                                ? `${gpsCoords.lat.toFixed(6)}, ${gpsCoords.lng.toFixed(6)}`
                                : t('detecting-location')}
                        </Text>
                    </View>
                    <Ionicons name="locate" size={18} color={theme.textSecondary} />
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => router.push('/places/map-picker' as any)}
                    disabled={saving}
                    activeOpacity={0.8}
                    className="flex-row items-center rounded-xl px-4 py-3.5"
                    style={{
                        borderWidth: 1,
                        borderColor: coordsSource === 'picked' && pickedCoords ? colors.primary.main : theme.border,
                        backgroundColor: coordsSource === 'picked' && pickedCoords ? theme.primaryMuted : 'transparent',
                    }}
                >
                    <Ionicons
                        name={coordsSource === 'picked' && pickedCoords ? 'radio-button-on' : 'radio-button-off'}
                        size={22}
                        color={coordsSource === 'picked' && pickedCoords ? colors.primary.main : theme.textSecondary}
                    />
                    <View className="ml-3 flex-1">
                        <Text className="text-base font-semibold" style={{ color: theme.textPrimary }}>
                            {t('pick-on-map')}
                        </Text>
                        {pickedCoords && (
                            <Text className="text-xs mt-0.5" style={{ color: theme.textSecondary }}>
                                {pickedCoords.lat.toFixed(6)}, {pickedCoords.lng.toFixed(6)}
                            </Text>
                        )}
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
                </TouchableOpacity>
            </View>

            {renderInput(t('label'), label, setLabel, t('home'))}
            {renderInput(t('country'), country, setCountry, t('country-placeholder'))}
            {renderInput(t('region'), region, setRegion, t('region-placeholder'))}
            {renderInput(t('city'), city, setCity, t('city-placeholder'))}
            {renderInput(t('subcity'), subCity, setSubCity, t('subcity-placeholder'))}
            {renderInput(t('woreda'), woreda, setWoreda, t('woreda-placeholder'))}
            {renderInput(t('sefer'), sefer, setSefer, t('sefer-placeholder'))}
            {renderInput(t('house-number'), houseNumber, setHouseNumber, '42')}
            {renderInput(t('floor-number'), floor, setFloor, '2', 'number-pad')}
            {renderInput(t('building-total-floors'), buildingTotalFloor, setBuildingTotalFloor, '5', 'number-pad')}

            <TouchableOpacity
                onPress={handleFormSubmit}
                disabled={saving}
                activeOpacity={0.8}
                className="rounded-xl py-4 items-center mb-8"
                style={{ backgroundColor: saving ? colors.primary.light : colors.primary.main }}
            >
                {saving ? (
                    <ActivityIndicator color="white" />
                ) : (
                    <Text className="text-white text-base font-semibold">{t('save')}</Text>
                )}
            </TouchableOpacity>
        </ScrollView>
    );

    return (
        <KeyboardAvoidingView
            className="flex-1"
            style={{ backgroundColor: theme.background }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <View
                className="flex-row items-center justify-between px-6 pb-4"
                style={{ paddingTop: insets.top + 12 }}
            >
                {step === 'choice' ? (
                    <View className="w-8" />
                ) : (
                    <TouchableOpacity
                        onPress={() => setStep('choice')}
                        disabled={saving}
                        className="w-8 h-8 items-center justify-center"
                    >
                        <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
                    </TouchableOpacity>
                )}
                <TouchableOpacity onPress={handleSkip} disabled={saving}>
                    <Text className="text-base font-semibold" style={{ color: theme.textSecondary }}>
                        {t('skip')}
                    </Text>
                </TouchableOpacity>
            </View>

            {step === 'choice' && renderChoice()}
            {step === 'followup' && renderFollowup()}
            {step === 'form' && renderForm()}

            <View style={{ height: insets.bottom + 16 }} />
        </KeyboardAvoidingView>
    );
};
