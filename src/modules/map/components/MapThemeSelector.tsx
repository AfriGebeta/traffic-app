import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Pressable, ScrollView, Image, ImageSourcePropType, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useMapTheme, MapTheme } from '../context/MapThemeContext';
import { useTheme } from '../../../shared/theme/ThemeContext';

interface MapThemeSelectorProps {
    visible: boolean;
    onClose: () => void;
    bottomOffset: number;
}

const CARD_WIDTH = 112;
const CARD_HEIGHT = 104;
const RIGHT_GUTTER = 72;

const PREVIEWS = {
    classic: require('../../../../assets/images/overlay-classic.png'),
    standard: require('../../../../assets/images/overlay-standard.png'),
    dark: require('../../../../assets/images/overlay-dark.png'),
    satellite: require('../../../../assets/images/overlay-satellite.png'),
} as const;

type PreviewKey = keyof typeof PREVIEWS;

const previewKeyFor = (theme: MapTheme): PreviewKey => {
    const haystack = `${theme.id} ${theme.name} ${theme.styleUrl ?? ''}`.toLowerCase();
    if (/dark|night/.test(haystack)) return 'dark';
    if (/raster|satellite|sat\b/.test(haystack)) return 'satellite';
    if (theme.id === 'standard' || /classic/.test(haystack)) return 'classic';
    return 'standard';
};

const previewFor = (theme: MapTheme): ImageSourcePropType => PREVIEWS[previewKeyFor(theme)];

const isDarkPreview = (theme: MapTheme): boolean => {
    const key = previewKeyFor(theme);
    return key === 'dark' || key === 'satellite';
};

export const MapThemeSelector: React.FC<MapThemeSelectorProps> = ({
    visible,
    onClose,
    bottomOffset,
}) => {
    const { t, i18n } = useTranslation();
    const { currentTheme, setTheme, themes } = useMapTheme();
    const { colors: theme } = useTheme();
    const isAmharic = i18n.language === 'am';
    const appear = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(appear, {
            toValue: visible ? 1 : 0,
            duration: 180,
            useNativeDriver: true,
        }).start();
    }, [visible]);

    if (!visible) return null;

    const handleSelectTheme = (mapTheme: MapTheme) => {
        setTheme(mapTheme.id);
        onClose();
    };

    return (
        <>
            <Pressable className="absolute inset-0" style={{ zIndex: 30 }} onPress={onClose} />

            <Animated.View
                className="absolute left-4 rounded-3xl shadow-lg"
                style={{
                    bottom: bottomOffset,
                    right: RIGHT_GUTTER,
                    zIndex: 31,
                    backgroundColor: theme.surface,
                    borderWidth: 1,
                    borderColor: theme.border,
                    opacity: appear,
                    transform: [{ scale: appear.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }],
                }}
            >
                <Text className="text-base font-bold px-4 pt-3" style={{ color: theme.textPrimary }}>
                    {t('pick-layers', 'Pick Layers')}
                </Text>

                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 12, gap: 10 }}
                >
                    {themes.map((mapTheme) => {
                        const isSelected = currentTheme.id === mapTheme.id;
                        const onDark = isDarkPreview(mapTheme);
                        return (
                            <TouchableOpacity
                                key={mapTheme.id}
                                onPress={() => handleSelectTheme(mapTheme)}
                                activeOpacity={0.85}
                                style={{ width: CARD_WIDTH, height: CARD_HEIGHT }}
                                className={`rounded-2xl overflow-hidden ${isSelected ? 'border-2 border-amber-500' : 'border border-gray-200'}`}
                            >
                                <Image
                                    source={previewFor(mapTheme)}
                                    style={{ position: 'absolute', width: '100%', height: '100%' }}
                                    resizeMode="cover"
                                />
                                <View className="flex-1 items-start justify-start px-2 pt-2">
                                    <Text
                                        className={`text-sm font-semibold ${onDark ? 'text-white' : 'text-gray-800'}`}
                                        numberOfLines={2}
                                        style={onDark ? { textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 6, textShadowOffset: { width: 0, height: 1 } } : undefined}
                                    >
                                        {isAmharic ? mapTheme.nameAmharic : mapTheme.name}
                                    </Text>
                                </View>
                                {isSelected && (
                                    <View className="absolute top-1 right-1">
                                        <Ionicons name="checkmark-circle" size={18} color="#F59E0B" />
                                    </View>
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </Animated.View>
        </>
    );
};
