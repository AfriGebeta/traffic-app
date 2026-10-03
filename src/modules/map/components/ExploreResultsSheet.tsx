import React, { useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withRepeat, withTiming } from 'react-native-reanimated';
import { useTranslation } from '../../../shared/hooks/useTranslation';
import { colors } from '../../../shared/theme/colors';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { haversine } from '../../navigation/utils/instructionEngine';
import { FALLBACK_CATEGORIES } from '../services/categoriesService';
import type { GeocodingPlace } from '../../navigation/types/navigation.types';

// collapsed sheet stays just under the floating buttons (PLACE_DETAIL_GAP in FloatingActions)
const PEEK_HEIGHT = 285;
const SPRING = { damping: 25, stiffness: 250, overshootClamping: true };

interface ExploreResultsSheetProps {
    categoryId: string;
    places: GeocodingPlace[];
    isLoading: boolean;
    userLocation: { lat: number; lng: number } | null;
    onSelectPlace: (place: GeocodingPlace) => void;
    onDirections: (place: GeocodingPlace) => void;
    onClose: () => void;
}

const formatDistance = (meters: number): string =>
    meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;

const SKELETON_ROWS = 3;

const ResultRowSkeleton: React.FC<{ showDivider: boolean }> = ({ showDivider }) => {
    const { colors: theme, isDark } = useTheme();
    const block = isDark ? theme.border : '#E5E7EB';
    const opacity = useSharedValue(1);

    useEffect(() => {
        opacity.value = withRepeat(withTiming(0.4, { duration: 700 }), -1, true);
    }, []);

    const pulseStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

    return (
        <Animated.View
            className="px-5 py-3.5 flex-row items-center"
            style={[
                {
                    borderBottomWidth: showDivider ? StyleSheet.hairlineWidth : 0,
                    borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : '#EEF0F2',
                },
                pulseStyle,
            ]}
        >
            <View className="flex-1 mr-3">
                <View style={{ height: 16, width: '70%', borderRadius: 4, backgroundColor: block }} />
                <View style={{ height: 12, width: '50%', borderRadius: 4, marginTop: 8, backgroundColor: block }} />
                <View style={{ height: 12, width: '40%', borderRadius: 4, marginTop: 6, backgroundColor: block }} />
            </View>
            <View style={{ gap: 8 }}>
                <View style={{ height: 34, width: 96, borderRadius: 8, backgroundColor: block }} />
                <View style={{ height: 34, width: 96, borderRadius: 8, backgroundColor: block }} />
            </View>
        </Animated.View>
    );
};

export const ExploreResultsSheet: React.FC<ExploreResultsSheetProps> = ({
    categoryId,
    places,
    isLoading,
    userLocation,
    onSelectPlace,
    onDirections,
    onClose,
}) => {
    const { t, isAmharic } = useTranslation();
    const { colors: theme, isDark } = useTheme();
    const insets = useSafeAreaInsets();
    const { height: windowHeight } = useWindowDimensions();

    const expandedHeight = Math.round(windowHeight * 0.62);
    const peekHeight = insets.bottom + PEEK_HEIGHT;

    // animate height (not translateY) so the list's bottom always sits above the system navbar
    const sheetHeight = useSharedValue(peekHeight);
    const dragStart = useSharedValue(0);

    // start collapsed every time a new category is opened
    useEffect(() => {
        sheetHeight.value = withSpring(peekHeight, SPRING);
    }, [categoryId, peekHeight]);

    const midHeight = (peekHeight + expandedHeight) / 2;

    const toggle = () => {
        sheetHeight.value = withSpring(sheetHeight.value < midHeight ? expandedHeight : peekHeight, SPRING);
    };

    const pan = Gesture.Pan()
        .onStart(() => {
            dragStart.value = sheetHeight.value;
        })
        .onUpdate((event) => {
            sheetHeight.value = Math.min(expandedHeight, Math.max(peekHeight, dragStart.value - event.translationY));
        })
        .onEnd((event) => {
            let target: number;
            if (event.velocityY < -500) target = expandedHeight;
            else if (event.velocityY > 500) target = peekHeight;
            else target = sheetHeight.value > midHeight ? expandedHeight : peekHeight;
            sheetHeight.value = withSpring(target, SPRING);
        });

    const animatedStyle = useAnimatedStyle(() => ({
        height: sheetHeight.value,
    }));

    const categoryLabel = useMemo(() => {
        const match = FALLBACK_CATEGORIES.find((c) => c.slug === categoryId);
        if (match) return match.label[isAmharic ? 'am' : 'en'];
        return categoryId.replace(/-/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
    }, [categoryId, isAmharic]);

    const sortedPlaces = useMemo(() => {
        const withDistance = places.map((place) => ({
            place,
            distance: userLocation
                ? haversine(userLocation, { lat: place.latitude, lng: place.longitude })
                : null,
        }));
        if (userLocation) {
            withDistance.sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
        }
        return withDistance;
    }, [places, userLocation]);

    const divider = isDark ? 'rgba(255,255,255,0.08)' : '#EEF0F2';

    return (
        <Animated.View
            style={[
                styles.container,
                { backgroundColor: theme.background },
                animatedStyle,
            ]}
        >
            <GestureDetector gesture={pan}>
                <View>
                    <TouchableOpacity activeOpacity={1} onPress={toggle} className="items-center pt-2.5 pb-2">
                        <View
                            style={{
                                width: 40,
                                height: 5,
                                borderRadius: 3,
                                backgroundColor: isDark ? theme.border : '#D1D5DB',
                            }}
                        />
                    </TouchableOpacity>

                    <View className="px-5 pb-3 flex-row items-center">
                        <View className="flex-1 mr-3">
                            <Text className="text-xl font-bold" style={{ color: theme.textPrimary }} numberOfLines={1}>
                                {categoryLabel}
                            </Text>
                            <Text className="text-xs mt-0.5" style={{ color: theme.textSecondary }}>
                                {isLoading
                                    ? t('loading')
                                    : `${t('nearby')} • ${places.length} ${t('places')}`}
                            </Text>
                        </View>
                        <TouchableOpacity
                            onPress={onClose}
                            className="w-9 h-9 items-center justify-center rounded-full"
                            style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : '#F3F4F6' }}
                        >
                            <Ionicons name="close" size={22} color={theme.textPrimary} />
                        </TouchableOpacity>
                    </View>
                    <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: divider }} />
                </View>
            </GestureDetector>

            {isLoading && places.length === 0 ? (
                <View>
                    {Array.from({ length: SKELETON_ROWS }, (_, i) => (
                        <ResultRowSkeleton key={i} showDivider={i < SKELETON_ROWS - 1} />
                    ))}
                </View>
            ) : places.length === 0 ? (
                <View className="items-center pt-8 px-6">
                    <Ionicons name="search-outline" size={28} color={theme.textSecondary} />
                    <Text className="text-sm mt-2 text-center" style={{ color: theme.textSecondary }}>
                        {t('no-nearby-places')}
                    </Text>
                </View>
            ) : (
                <ScrollView
                    style={{ flex: 1 }}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
                >
                    {sortedPlaces.map(({ place, distance }, index) => {
                        const typeLabel = place.type || place.category || '';
                        const meta = [typeLabel, distance !== null ? formatDistance(distance) : null]
                            .filter(Boolean)
                            .join(' • ');
                        const locationLine = [place.District, place.City].filter(Boolean).join(', ');

                        return (
                            <TouchableOpacity
                                key={`${place.id}-${index}`}
                                activeOpacity={0.7}
                                onPress={() => onSelectPlace(place)}
                                className="px-5 py-3.5"
                                style={{
                                    borderBottomWidth: index === sortedPlaces.length - 1 ? 0 : StyleSheet.hairlineWidth,
                                    borderBottomColor: divider,
                                }}
                            >
                                <View className="flex-row items-center">
                                    <View className="flex-1 mr-3">
                                        <Text className="text-base font-semibold" style={{ color: theme.textPrimary }} numberOfLines={1}>
                                            {place.name}
                                        </Text>
                                        {!!meta && (
                                            <Text className="text-[13px] mt-0.5 capitalize" style={{ color: theme.textSecondary }} numberOfLines={1}>
                                                {meta}
                                            </Text>
                                        )}
                                        {!!locationLine && (
                                            <Text className="text-[13px] mt-0.5" style={{ color: theme.textSecondary }} numberOfLines={1}>
                                                {locationLine}
                                            </Text>
                                        )}
                                    </View>

                                    <View style={{ gap: 8 }}>
                                        <TouchableOpacity
                                            onPress={() => onDirections(place)}
                                            activeOpacity={0.7}
                                            className="items-center"
                                            style={{ paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, backgroundColor: colors.primary.main }}
                                        >
                                            <Text className="text-[13px] font-semibold" style={{ color: '#FFFFFF' }}>
                                                {t('directions')}
                                            </Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            onPress={() => onSelectPlace(place)}
                                            activeOpacity={0.7}
                                            className="items-center"
                                            style={{
                                                paddingVertical: 7,
                                                paddingHorizontal: 15,
                                                borderRadius: 8,
                                                borderWidth: 1,
                                                borderColor: isDark ? 'rgba(255,255,255,0.3)' : colors.primary.main,
                                            }}
                                        >
                                            <Text
                                                className="text-[13px] font-semibold"
                                                style={{ color: isDark ? theme.textPrimary : colors.primary.main }}
                                            >
                                                {t('details')}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            )}
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 40,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 24,
    },
});
