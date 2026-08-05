import React from 'react';
import { View, Text, Modal, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../../shared/theme/colors';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { CategorySection } from './CategorySection';
import { PLACEHOLDER_PLACES } from '../data/placeholderPlaces';
import type { GeocodingPlace } from '../../navigation/types/navigation.types';

interface ExploreSheetProps {
    visible: boolean;
    onClose: () => void;
    userLocation: { lat: number; lng: number } | null;
    onPlaceSelect: (place: GeocodingPlace) => void;
}

const JAKARTA_REGULAR = 'PlusJakartaSans-Regular';
const JAKARTA_BOLD = 'PlusJakartaSans-Bold';
const JAKARTA_EXTRABOLD = 'PlusJakartaSans-ExtraBold';
const IMAGE_BLUR_RADIUS = 12;

export const ExploreSheet: React.FC<ExploreSheetProps> = ({
    visible,
    onClose,
}) => {
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const { colors: theme, isDark } = useTheme();

    const noop = () => { };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <Pressable className="flex-1 justify-end bg-black/50" onPress={onClose}>
                <Pressable
                    className="rounded-t-3xl max-h-[85%] overflow-hidden"
                    style={{ paddingBottom: insets.bottom, backgroundColor: theme.background }}
                    onPress={(e) => e.stopPropagation()}
                >
                    <View className="p-6" style={{ borderBottomWidth: 1, borderBottomColor: theme.border }}>
                        <View className="w-12 h-1 rounded-full self-center mb-4" style={{ backgroundColor: theme.border }} />
                        <View className="flex-row items-center justify-between">
                            <View className="flex-row items-center flex-1">
                                <Ionicons name="compass" size={24} color={colors.primary.main} />
                                <Text
                                    className="text-2xl ml-2"
                                    style={{ fontFamily: JAKARTA_BOLD, color: theme.textPrimary }}
                                >
                                    {t('explore-nearby')}
                                </Text>
                            </View>
                            <Pressable onPress={onClose} className="p-2">
                                <Ionicons name="close" size={24} color={theme.textSecondary} />
                            </Pressable>
                        </View>
                    </View>

                    <View>
                        <ScrollView
                            className="px-6 py-4"
                            showsVerticalScrollIndicator={false}
                            scrollEnabled={false}
                            pointerEvents="none"
                            contentContainerStyle={{ paddingBottom: 20 }}
                        >
                            <CategorySection
                                categoryId="museum"
                                places={PLACEHOLDER_PLACES.museum ?? []}
                                onPlacePress={noop}
                                onSeeMore={noop}
                                onSeeLess={noop}
                                imageBlurRadius={IMAGE_BLUR_RADIUS}
                            />
                            <CategorySection
                                categoryId="hotel"
                                places={PLACEHOLDER_PLACES.hotel ?? []}
                                onPlacePress={noop}
                                onSeeMore={noop}
                                onSeeLess={noop}
                                imageBlurRadius={IMAGE_BLUR_RADIUS}
                            />
                            <CategorySection
                                categoryId="park"
                                places={PLACEHOLDER_PLACES.park ?? []}
                                onPlacePress={noop}
                                onSeeMore={noop}
                                onSeeLess={noop}
                                imageBlurRadius={IMAGE_BLUR_RADIUS}
                            />
                        </ScrollView>

                        <BlurView
                            intensity={40}
                            tint={isDark ? 'dark' : 'light'}
                            experimentalBlurMethod="dimezisBlurView"
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                alignItems: 'center',
                                justifyContent: 'center',
                                paddingBottom: 60,
                            }}
                        >
                            <View
                                className="items-center px-8 py-6 mx-6 rounded-2xl"
                                style={{
                                    backgroundColor: isDark ? 'rgba(30, 30, 30, 0.8)' : 'rgba(255, 255, 255, 0.88)',
                                    borderWidth: 1,
                                    borderColor: theme.border,
                                }}
                            >
                                <Ionicons name="hourglass-outline" size={28} color={colors.primary.main} />
                                <Text
                                    className="mt-3 text-center"
                                    style={{ fontFamily: JAKARTA_EXTRABOLD, fontSize: 22, lineHeight: 32, color: theme.textPrimary }}
                                >
                                    {t('explore-coming-soon')}
                                </Text>
                                <Text
                                    className="mt-2 text-center"
                                    style={{ fontFamily: JAKARTA_REGULAR, fontSize: 13, lineHeight: 19, color: theme.textSecondary }}
                                >
                                    {t('explore-coming-soon-subtitle')}
                                </Text>
                            </View>
                        </BlurView>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
};
