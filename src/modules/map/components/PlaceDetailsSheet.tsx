import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { colors } from '../../../shared/theme/colors';
import { useTheme } from '../../../shared/theme/ThemeContext';
import type { GeocodingPlace } from '../../navigation/types/navigation.types';
import { ShareLocationButton } from '../../../shared/components/ShareLocationButton';
import { placeService } from '../../places/services/place.service';
import { showToast } from '../../../shared/utils/toast';
import type { SavedPlace } from '../../places/types/place.types';

interface PlaceDetailsSheetProps {
    place: GeocodingPlace | null;
    onClose: () => void;
    onNavigate: (place: GeocodingPlace) => void;
}

export const PlaceDetailsSheet: React.FC<PlaceDetailsSheetProps> = ({
    place,
    onClose,
    onNavigate,
}) => {
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const { colors: theme, isDark } = useTheme();
    const router = useRouter();
    const [savedPlace, setSavedPlace] = useState<SavedPlace | null>(null);

    useEffect(() => {
        checkIfSaved();
    }, [place]);

    useFocusEffect(
        React.useCallback(() => {
            checkIfSaved();
        }, [place])
    );

    const checkIfSaved = async () => {
        if (!place) return;
        const saved = await placeService.isPlaceSaved(place.latitude, place.longitude);
        setSavedPlace(saved);
    };

    if (!place) return null;

    const handleUnsavePlace = async () => {
        if (!savedPlace) return;

        try {
            await placeService.deleteSavedPlace(savedPlace.id);
            setSavedPlace(null);
            showToast(t('place-removed'));
        } catch (error) {
            showToast(t('failed-to-remove-place'));
            console.error('Error removing place:', error);
        }
    };

    return (
        <Modal
            visible={!!place}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <Pressable
                className="flex-1 justify-end bg-black/50"
                onPress={onClose}
            >
                <View className="rounded-t-3xl overflow-hidden">
                    <BlurView intensity={100} tint={isDark ? 'dark' : 'light'} style={{ borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
                        <View style={{ backgroundColor: isDark ? 'rgba(30, 30, 30, 0.6)' : 'rgba(255, 255, 255, 0.4)', borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
                            <Pressable
                                className="p-6"
                                style={{
                                    paddingBottom: insets.bottom + 24
                                }}
                                onPress={(e) => e.stopPropagation()}
                            >
                                <View className="w-12 h-1 rounded-full self-center mb-4" style={{ backgroundColor: theme.border }} />

                                <View className="flex-row items-start mb-4">
                                    <View className="flex-1">
                                        <Text className="text-2xl font-bold mb-1" style={{ color: theme.textPrimary }}>
                                            {place.name}
                                        </Text>
                                        {(place.City || place.Country) && (
                                            <Text className="text-sm" style={{ color: theme.textSecondary }}>
                                                {[place.City, place.Country].filter(Boolean).join(', ')}
                                            </Text>
                                        )}
                                        <View className="flex-row items-center mt-2">
                                            <Ionicons name="location" size={16} color={theme.textSecondary} />
                                            <Text className="text-sm ml-1" style={{ color: theme.textSecondary }}>
                                                {place.type === 'coordinates' ? place.display_name : place.type}
                                            </Text>
                                        </View>
                                    </View>
                                    <TouchableOpacity
                                        onPress={onClose}
                                        className="p-2"
                                    >
                                        <Ionicons name="close" size={24} color={theme.textSecondary} />
                                    </TouchableOpacity>
                                </View>

                                <TouchableOpacity
                                    onPress={() => {
                                        onNavigate(place);
                                        onClose();
                                    }}
                                    style={{ backgroundColor: colors.primary.main }}
                                    className="rounded-xl py-4 px-4 flex-row items-center justify-center"
                                >
                                    <Text className="text-white font-semibold text-base" numberOfLines={1}>
                                        {t('directions')}
                                    </Text>
                                </TouchableOpacity>

                                <View className="flex-row gap-3 mt-3">
                                    <View className="flex-1">
                                        <ShareLocationButton
                                            location={{
                                                lat: place.latitude,
                                                lng: place.longitude,
                                                name: place.name,
                                                city: place.City,
                                                country: place.Country,
                                                type: place.type,
                                            }}
                                            variant="secondary"
                                            size="medium"
                                        />
                                    </View>
                                    <TouchableOpacity
                                        onPress={savedPlace ? handleUnsavePlace : () => router.push({
                                            pathname: '/places/save',
                                            params: { lat: place.latitude, lng: place.longitude, name: place.name },
                                        } as any)}
                                        className="rounded-xl py-4 px-4 flex-row items-center justify-center"
                                        style={{ minWidth: 60, backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : '#F3F4F6' }}
                                    >
                                        <Ionicons
                                            name={savedPlace ? "bookmark" : "bookmark-outline"}
                                            size={20}
                                            color={theme.textPrimary}
                                        />
                                    </TouchableOpacity>
                                </View>
                            </Pressable>
                        </View>
                    </BlurView>
                </View>
            </Pressable>
        </Modal>
    );
};
