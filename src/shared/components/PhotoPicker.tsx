import React, { useState } from 'react';
import { ActivityIndicator, Image, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme/ThemeContext';
import { useContentWidth } from '../layout/ResponsiveScreen';
import { uploadToMinio } from '../utils/minio';
import { showToast } from '../utils/toast';
import { InAppCamera } from './InAppCamera';

export interface UploadedPhoto {
    localUri: string;
    objectName: string;
}

interface PhotoPickerProps {
    photos: UploadedPhoto[];
    onChange: (photos: UploadedPhoto[]) => void;
    // MinIO folder, e.g. "rules"
    folder: string;
    // horizontal padding of the parent screen, so three tiles fit per row
    horizontalPadding?: number;
}

// Camera + gallery tiles with thumbnails; uploads straight to MinIO and returns object names.
// Same look as the incident report photo section.
export function PhotoPicker({ photos, onChange, folder, horizontalPadding = 48 }: PhotoPickerProps) {
    const { t } = useTranslation();
    const { colors: theme, isDark } = useTheme();
    const width = useContentWidth();
    const tileSize = Math.floor((width - horizontalPadding - 24) / 3);
    const [uploading, setUploading] = useState(false);
    const [cameraOpen, setCameraOpen] = useState(false);

    const upload = async (uris: string[]) => {
        setUploading(true);
        try {
            const uploaded = await Promise.all(
                uris.map(async (uri) => ({ localUri: uri, objectName: await uploadToMinio(uri, folder) }))
            );
            onChange([...photos, ...uploaded]);
            showToast(`${t('image-uploaded')}: ${t('photo-added-successfully')}`);
        } catch {
            showToast(`${t('upload-failed')}: ${t('could-not-upload-image')}`);
        } finally {
            setUploading(false);
        }
    };

    // in-app camera: never leaves our activity, and tags the photo for campaign verification
    const takePhoto = () => setCameraOpen(true);

    const pickFromGallery = async () => {
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
        if (!result.canceled && result.assets.length > 0) await upload(result.assets.map((asset) => asset.uri));
    };

    const tileStyle = {
        width: tileSize,
        height: tileSize,
        backgroundColor: theme.surface,
        borderWidth: 2,
        borderStyle: 'dashed' as const,
        borderColor: theme.border,
    };

    const sourceTile = (icon: 'camera' | 'images', label: string, onPress: () => void) => (
        <TouchableOpacity
            className="rounded-2xl items-center justify-center"
            style={tileStyle}
            onPress={onPress}
            disabled={uploading}
            activeOpacity={0.7}
        >
            <View className="rounded-full p-3 mb-2" style={{ backgroundColor: isDark ? theme.background : '#F3F4F6' }}>
                <Ionicons name={icon} size={24} color={theme.textSecondary} />
            </View>
            <Text className="text-xs font-medium" style={{ color: theme.textSecondary }}>{label}</Text>
        </TouchableOpacity>
    );

    return (
        <View>
            <InAppCamera visible={cameraOpen} onClose={() => setCameraOpen(false)} onCaptured={(uri) => void upload([uri])} />
            <View className="flex-row flex-wrap gap-3">
                {sourceTile('camera', t('camera'), takePhoto)}
                {sourceTile('images', t('gallery'), pickFromGallery)}
                {photos.map(({ localUri }, index) => (
                    <View key={`${localUri}-${index}`} className="relative">
                        <Image source={{ uri: localUri }} style={{ width: tileSize, height: tileSize, borderRadius: 16 }} />
                        <TouchableOpacity
                            className="absolute -top-2 -right-2 bg-red-500 rounded-full w-7 h-7 items-center justify-center shadow-lg"
                            onPress={() => onChange(photos.filter((_, i) => i !== index))}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="close" size={16} color="white" />
                        </TouchableOpacity>
                    </View>
                ))}
            </View>

            {uploading && (
                <View className="flex-row items-center mt-3 rounded-xl p-3" style={{ backgroundColor: theme.blueMuted }}>
                    <ActivityIndicator size="small" color={theme.blue} />
                    <Text className="text-sm ml-2 font-medium" style={{ color: theme.blue }}>{t('uploading')}</Text>
                </View>
            )}
        </View>
    );
}
