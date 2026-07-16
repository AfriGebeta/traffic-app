import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, Image, ActivityIndicator, BackHandler } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Button } from '../../../shared/components';
import { useIncidentReport } from '../hooks/useIncidentReport';
import { colors } from '../../../shared/theme/colors';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { showToast } from '../../../shared/utils/toast';
import { useTranslation } from '../../../shared/hooks/useTranslation';
import { getIncidentTranslationKey } from '../utils/incidentTranslations';
import { uploadToMinio } from '../../../shared/utils/minio';
import { dashboardEventsService } from '../../../shared/services/dashboard-events.service';

export default function IncidentReportScreen() {
    const { t } = useTranslation();
    const router = useRouter();
    const params = useLocalSearchParams();
    const { colors: theme, isDark } = useTheme();
    const incidentTypeName = params.typeName as string;
    const passedLat = params.lat ? parseFloat(params.lat as string) : null;
    const passedLng = params.lng ? parseFloat(params.lng as string) : null;


    const [description, setDescription] = useState('');
    const [direction, setDirection] = useState('');
    const [images, setImages] = useState<string[]>([]);
    const [uploading, setUploading] = useState(false);
    const { reportIncident, loading, error } = useIncidentReport();

    useEffect(() => {
        const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
            router.back();
            return true;
        });

        return () => backHandler.remove();
    }, [router]);

    const location = passedLat && passedLng ? { lat: passedLat, lng: passedLng } : null;

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (status !== 'granted') {
            showToast.error(t('permission-denied'), t('camera-roll-permission-required'));
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: 'images',
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.8,
        });

        if (!result.canceled && result.assets[0]) {
            await uploadImage(result.assets[0].uri);
        }
    };

    const takePhoto = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();

        if (status !== 'granted') {
            showToast.error(t('permission-denied'), t('camera-permission-required'));
            return;
        }

        const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.8,
        });

        if (!result.canceled && result.assets[0]) {
            await uploadImage(result.assets[0].uri);
        }
    };

    const uploadImage = async (uri: string) => {
        setUploading(true);
        try {
            const url = await uploadToMinio(uri, 'incidents');
            setImages((prev) => [...prev, url]);
            showToast.success(t('image-uploaded'), t('photo-added-successfully'));
        } catch (error) {
            showToast.error(t('upload-failed'), t('could-not-upload-image'));
        } finally {
            setUploading(false);
        }
    };

    const removeImage = (index: number) => {
        setImages((prev) => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async () => {
        if (!location) {
            showToast.error('Location not available');
            return;
        }

        const incident = await reportIncident(
            incidentTypeName,
            description.trim() || 'No description provided',
            location,
            direction.trim() || undefined,
            images
        );

        if (incident) {
            console.log('Incident created:', incident);
            dashboardEventsService.contribute();
            showToast.success(t('incident-reported-successfully'));
            setTimeout(() => {
                router.back();
            }, 500);
        } else if (error) {
            showToast.error(error);
        }
    };

    const iconName = incidentTypeName ? (incidentTypeName.toLowerCase().replace('_', '-')) : 'other';
    const color = colors.primary.main;

    return (
        <ScrollView className="flex-1" style={{ backgroundColor: theme.background }}>
            <View className="px-6 pt-12 pb-6">
                <View
                    className="w-16 h-16 rounded-full items-center justify-center mb-4"
                    style={{ backgroundColor: color + '20' }}
                >
                    <Ionicons name="warning" size={32} color={color} />
                </View>

                <Text className="text-3xl font-bold mb-2" style={{ color: theme.textPrimary }}>
                    {t('report')}: {t(getIncidentTranslationKey(iconName))}
                </Text>

                {location ? (
                    <Text className="mb-6" style={{ color: theme.textSecondary }}>
                        {t('location')}: {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                    </Text>
                ) : (
                    <Text className="mb-6" style={{ color: theme.textSecondary }}>{t('getting-location')}</Text>
                )}

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
                        style={{ backgroundColor: theme.surface, borderWidth: 2, borderStyle: 'dashed', borderColor: theme.border }}
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
                        {images.map((uri, index) => (
                            <View key={index} className="relative">
                                <Image source={{ uri }} className="w-28 h-28 rounded-2xl" />
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
    );
}
