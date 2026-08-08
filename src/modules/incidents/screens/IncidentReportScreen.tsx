import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, Image, ActivityIndicator, BackHandler, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import AccidentLightIcon from '../../../../assets/images/accident-light.svg';
import AccidentDarkIcon from '../../../../assets/images/accident-dark.svg';
import BadWeatherLightIcon from '../../../../assets/images/bad-weather-light.svg';
import BadWeatherDarkIcon from '../../../../assets/images/bad-weather-dark.svg';
import BrokenRoadLightIcon from '../../../../assets/images/broken-road-light.svg';
import BrokenRoadDarkIcon from '../../../../assets/images/broken-road-dark.svg';
import ClosureLightIcon from '../../../../assets/images/closure-light.svg';
import ClosureDarkIcon from '../../../../assets/images/closure-dark.svg';
import CrashLightIcon from '../../../../assets/images/crash-light.svg';
import CrashDarkIcon from '../../../../assets/images/crash-dark.svg';

import GatedCommunityLightIcon from '../../../../assets/images/gated-community-light.svg';
import GatedCommunityDarkIcon from '../../../../assets/images/gated-community-dark.svg';
import HazardLightIcon from '../../../../assets/images/hazard-light.svg';
import HazardDarkIcon from '../../../../assets/images/hazard-dark.svg';
import OtherLightIcon from '../../../../assets/images/other-light.svg';
import OtherDarkIcon from '../../../../assets/images/other-dark.svg';
import RadarLightIcon from '../../../../assets/images/radar-light.svg';
import RadarDarkIcon from '../../../../assets/images/radar-dark.svg';
import TrafficJamLightIcon from '../../../../assets/images/traffic-jam-light.svg';
import TrafficJamDarkIcon from '../../../../assets/images/traffic-jam-dark.svg';

import { Button } from '../../../shared/components';
import { useIncidentReport } from '../hooks/useIncidentReport';
import { colors } from '../../../shared/theme/colors';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { showToast } from '../../../shared/utils/toast';
import { useTranslation } from '../../../shared/hooks/useTranslation';
import { getIncidentTranslationKey } from '../utils/incidentTranslations';
import { uploadToMinio } from '../../../shared/utils/minio';
import { dashboardEventsService } from '../../../shared/services/dashboard-events.service';
import { useLocation } from '../../../shared/contexts/LocationContext';

type IncidentIcon = React.FC<{ width?: number; height?: number }>;

const INCIDENT_ICON_MAP: Record<string, { light: IncidentIcon; dark: IncidentIcon }> = {
    'ROAD_CLOSURE': { light: ClosureLightIcon, dark: ClosureDarkIcon },
    'ACCIDENT': { light: AccidentLightIcon, dark: AccidentDarkIcon },
    'TRAFFIC_JAM': { light: TrafficJamLightIcon, dark: TrafficJamDarkIcon },
    'BAD_WEATHER': { light: BadWeatherLightIcon, dark: BadWeatherDarkIcon },
    'HAZARD': { light: HazardLightIcon, dark: HazardDarkIcon },
    'CRASH': { light: CrashLightIcon, dark: CrashDarkIcon },
    'GATED_COMMUNITY': { light: GatedCommunityLightIcon, dark: GatedCommunityDarkIcon },
    'BROKEN_ROAD': { light: BrokenRoadLightIcon, dark: BrokenRoadDarkIcon },
    'RADAR': { light: RadarLightIcon, dark: RadarDarkIcon },
    'OTHER': { light: OtherLightIcon, dark: OtherDarkIcon },
};

export default function IncidentReportScreen() {
    const { t } = useTranslation();
    const router = useRouter();
    const params = useLocalSearchParams();
    const { colors: theme, isDark } = useTheme();
    const insets = useSafeAreaInsets();
    const incidentTypeName = params.typeName as string;
    const passedLat = params.lat ? parseFloat(params.lat as string) : null;
    const passedLng = params.lng ? parseFloat(params.lng as string) : null;


    const { selectedLocation, setSelectedLocation } = useLocation();
    const currentLocation = passedLat && passedLng ? { lat: passedLat, lng: passedLng } : null;

    const [pickedLocation, setPickedLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [description, setDescription] = useState('');
    const [direction, setDirection] = useState('');
    const [images, setImages] = useState<{ localUri: string; objectName: string }[]>([]);
    const [uploading, setUploading] = useState(false);
    const { reportIncident, loading, error } = useIncidentReport();

    useEffect(() => {
        const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
            router.back();
            return true;
        });

        return () => backHandler.remove();
    }, [router]);

    useFocusEffect(
        React.useCallback(() => {
            if (selectedLocation) {
                setPickedLocation(selectedLocation);
                setSelectedLocation(null);
            }
        }, [selectedLocation, setSelectedLocation])
    );

    const location = pickedLocation ?? currentLocation;

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (status !== 'granted') {
            showToast(`${t('permission-denied')}: ${t('camera-roll-permission-required')}`);
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: 'images',
            allowsMultipleSelection: true,
            selectionLimit: 0,
            quality: 0.8,
        });

        if (!result.canceled && result.assets.length > 0) {
            await uploadImages(result.assets.map((a) => a.uri));
        }
    };

    const takePhoto = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();

        if (status !== 'granted') {
            showToast(`${t('permission-denied')}: ${t('camera-permission-required')}`);
            return;
        }

        const result = await ImagePicker.launchCameraAsync({
            quality: 0.8,
        });

        if (!result.canceled && result.assets[0]) {
            await uploadImages([result.assets[0].uri]);
        }
    };

    const uploadImages = async (uris: string[]) => {
        setUploading(true);
        try {
            const uploaded = await Promise.all(
                uris.map(async (uri) => ({ localUri: uri, objectName: await uploadToMinio(uri, 'incidents') }))
            );
            setImages((prev) => [...prev, ...uploaded]);
            showToast(`${t('image-uploaded')}: ${t('photo-added-successfully')}`);
        } catch (error) {
            showToast(`${t('upload-failed')}: ${t('could-not-upload-image')}`);
        } finally {
            setUploading(false);
        }
    };

    const removeImage = (index: number) => {
        setImages((prev) => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async () => {
        if (!location) {
            showToast('Location not available');
            return;
        }

        const incident = await reportIncident(
            incidentTypeName,
            description.trim() || 'No description provided',
            location,
            direction.trim() || undefined,
            images.map((img) => img.objectName)
        );

        if (incident) {
            console.log('Incident created:', incident);
            dashboardEventsService.contribute();
            showToast(t('incident-reported-successfully'));
            setTimeout(() => {
                router.back();
            }, 500);
        } else if (error) {
            showToast(error);
        }
    };

    const iconName = incidentTypeName ? (incidentTypeName.toLowerCase().replace('_', '-')) : 'other';
    const color = colors.primary.main;
    const iconPair = INCIDENT_ICON_MAP[incidentTypeName];
    const IncidentSvgIcon = iconPair ? (isDark ? iconPair.dark : iconPair.light) : null;

    return (
        <KeyboardAvoidingView
            className="flex-1"
            style={{ backgroundColor: theme.background }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <ScrollView
                className="flex-1"
                style={{ backgroundColor: theme.background }}
                contentContainerStyle={{ paddingBottom: insets.bottom + 32, flexGrow: 1 }}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                showsVerticalScrollIndicator={false}
            >
                <View className="px-6 pb-6" style={{ paddingTop: insets.top + 16 }}>
                    <View
                        className="w-16 h-16 items-center justify-center mb-4"
                    >
                        {IncidentSvgIcon ? (
                            <IncidentSvgIcon width={48} height={48} />
                        ) : (
                            <Ionicons name="warning" size={32} color={color} />
                        )}
                    </View>

                    <Text className="text-3xl font-bold mb-2" style={{ color: theme.textPrimary }}>
                        {t('report')}: {t(getIncidentTranslationKey(iconName))}
                    </Text>

                    <View className="mb-6 rounded-2xl p-4" style={{ backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }}>
                        <View className="flex-row items-center">
                            <Ionicons
                                name={pickedLocation ? 'location' : 'locate'}
                                size={20}
                                color={theme.textSecondary}
                            />
                            <View className="ml-3 flex-1">
                                <Text className="text-sm font-semibold" style={{ color: theme.textPrimary }}>
                                    {pickedLocation ? t('location-selected') : t('current-location')}
                                </Text>
                                <Text className="text-sm" style={{ color: theme.textSecondary }}>
                                    {location
                                        ? `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`
                                        : t('getting-location')}
                                </Text>
                            </View>
                        </View>


                        <View className="mt-3">

                            <TouchableOpacity
                                className="py-3 rounded-xl  flex-row items-center justify-center"
                                style={{ backgroundColor: isDark ? theme.background : '#e8e8e8ff' }}
                                onPress={() => router.push('/incident-map-picker')}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="map" size={18} color={theme.textSecondary} />
                                <Text className="text-sm font-semibold ml-2" style={{ color: theme.textPrimary }}>
                                    {t('pick-location-on-map')}
                                </Text>
                            </TouchableOpacity>

                            {pickedLocation && (
                                <>
                                    <View className="flex-row items-center justify-center my-2">
                                        <View className="flex-1 h-px" style={{ backgroundColor: theme.border }} />
                                        <Text className="text-sm mx-3" style={{ color: theme.textSecondary }}>{t('or')}</Text>
                                        <View className="flex-1 h-px" style={{ backgroundColor: theme.border }} />
                                    </View>
                                    <TouchableOpacity
                                        className="py-3 rounded-xl flex-row items-center justify-center"
                                        style={{ backgroundColor: isDark ? theme.background : '#F3F4F6' }}
                                        onPress={() => setPickedLocation(null)}
                                        activeOpacity={0.7}
                                        disabled={!currentLocation}
                                    >
                                        <Ionicons name="locate" size={18} color={theme.textSecondary} />

                                        <Text className="text-sm font-semibold ml-2" style={{ color: theme.textPrimary }}>
                                            {t('use-current-location')}
                                        </Text>
                                    </TouchableOpacity>
                                </>
                            )}
                        </View>
                    </View>

                    <Text className="text-sm font-semibold mb-2" style={{ color: theme.textPrimary }}>
                        {t('description')}
                    </Text>

                    <TextInput
                        className="border-2 rounded-xl p-4 text-base min-h-32 mb-4"
                        style={{ backgroundColor: theme.surface, borderColor: theme.border, color: theme.textPrimary, textAlignVertical: 'top' }}
                        placeholder={t('describe-situation')}
                        placeholderTextColor={theme.textSecondary}
                        value={description}
                        onChangeText={setDescription}
                        multiline
                        numberOfLines={6}
                        maxLength={500}
                    />

                    <Text className="text-xs mb-4" style={{ color: theme.textSecondary }}>
                        {description.length}/500 {t('characters')}
                    </Text>

                    <Text className="text-sm font-semibold mb-2" style={{ color: theme.textPrimary }}>
                        {t('direction-optional')}
                    </Text>

                    <TextInput
                        className="border-2 rounded-xl p-4 text-base mb-6"
                        style={{ backgroundColor: theme.surface, borderColor: theme.border, color: theme.textPrimary }}
                        placeholder={t('north-south')}
                        placeholderTextColor={theme.textSecondary}
                        value={direction}
                        onChangeText={setDirection}
                        maxLength={50}
                    />

                    <Text className="text-sm font-semibold mb-2" style={{ color: theme.textPrimary }}>
                        {t('photos')} ({t('optional')})
                    </Text>

                    <View className="flex-row gap-3 mb-3">
                        <TouchableOpacity
                            className="rounded-2xl w-28 h-28 items-center justify-center"
                            style={{ backgroundColor: theme.surface, borderWidth: 2, borderStyle: 'dashed', borderColor: theme.border }}
                            onPress={takePhoto}
                            disabled={uploading}
                            activeOpacity={0.7}
                        >
                            <View className="rounded-full p-3 mb-2" style={{ backgroundColor: isDark ? theme.background : '#F3F4F6' }}>
                                <Ionicons name="camera" size={24} color={theme.textSecondary} />
                            </View>
                            <Text className="text-xs font-medium" style={{ color: theme.textSecondary }}>{t('camera')}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            className="rounded-2xl w-28 h-28 items-center justify-center"
                            style={{
                                backgroundColor: theme.surface,
                                borderWidth: 2,
                                borderStyle: 'dashed',
                                borderColor: theme.border
                            }}
                            onPress={pickImage}
                            disabled={uploading}
                            activeOpacity={0.7}
                        >
                            <View className="rounded-full p-3 mb-2" style={{ backgroundColor: isDark ? theme.background : '#F3F4F6' }}>
                                <Ionicons name="images" size={24} color={theme.textSecondary} />
                            </View>

                            <Text className="text-xs font-medium" style={{ color: theme.textSecondary }}>{t('gallery')}</Text>
                        </TouchableOpacity>
                    </View>

                    {uploading && (
                        <View className="flex-row items-center mb-3 rounded-xl p-3" style={{ backgroundColor: theme.blueMuted }}>
                            <ActivityIndicator size="small" color={theme.blue} />
                            <Text className="text-sm ml-2 font-medium" style={{ color: theme.blue }}>{t('uploading')}</Text>
                        </View>
                    )}

                    {images.length > 0 && (
                        <View className="flex-row flex-wrap gap-3 mb-6">
                            {images.map(({ localUri }, index) => (
                                <View key={index} className="relative">
                                    <Image source={{ uri: localUri }} className="w-28 h-28 rounded-2xl" />
                                    <TouchableOpacity
                                        className="absolute -top-2 -right-2 bg-red-500 rounded-full w-7 h-7 items-center justify-center shadow-lg"
                                        onPress={() => removeImage(index)}
                                        activeOpacity={0.8}
                                    >
                                        <Ionicons name="close" size={16} color="white" />
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </View>
                    )}

                    <Button
                        title={t('submit-report')}
                        onPress={handleSubmit}
                        disabled={!location}
                        loading={loading}
                    />

                    <Button
                        title={t('cancel')}
                        variant="outline"
                        onPress={() => router.back()}
                        style={{ marginTop: 12 }}
                    />
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}
