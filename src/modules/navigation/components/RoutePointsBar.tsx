import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, TextInput, Modal, KeyboardAvoidingView, Platform, FlatList, ActivityIndicator, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from '../../../shared/hooks/useTranslation';
import { colors } from '../../../shared/theme/colors';
import { useTheme } from '../../../shared/theme/ThemeContext';
import type { GeocodingPlace } from '../types/navigation.types';
import { navigationService } from '../services/navigation.service';
import { useRouter } from 'expo-router';

interface RoutePointsBarProps {
    origin: GeocodingPlace | null;
    waypoints: GeocodingPlace[];
    destination: GeocodingPlace | null;
    onOriginChange?: (place: GeocodingPlace | null) => void;
    onWaypointsChange?: (waypoints: GeocodingPlace[]) => void;
    onClose?: () => void;
    transportMode?: 'driving' | 'taxi' | 'walking';
}

export const RoutePointsBar: React.FC<RoutePointsBarProps> = ({
    origin,
    waypoints,
    destination,
    onOriginChange,
    onWaypointsChange,
    onClose,
    transportMode = 'driving',
}) => {
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { colors: theme, isDark } = useTheme();

    const [showPlaceSearch, setShowPlaceSearch] = useState(false);
    const [placeSearchMode, setPlaceSearchMode] = useState<'origin' | 'stop'>('stop');
    const [placeSearchQuery, setPlaceSearchQuery] = useState('');
    const [placeSearchResults, setPlaceSearchResults] = useState<GeocodingPlace[]>([]);
    const [isSearchingPlace, setIsSearchingPlace] = useState(false);
    const placeSearchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handlePlaceSearchChange = (query: string) => {
        setPlaceSearchQuery(query);
        if (placeSearchDebounce.current) clearTimeout(placeSearchDebounce.current);
        if (query.length < 2) {
            setPlaceSearchResults([]);
            return;
        }
        placeSearchDebounce.current = setTimeout(async () => {
            setIsSearchingPlace(true);
            try {
                const results = await navigationService.geocodePlace(query);
                setPlaceSearchResults(results);
            } catch {
                setPlaceSearchResults([]);
            } finally {
                setIsSearchingPlace(false);
            }
        }, 350);
    };

    const openPlaceSearch = (mode: 'origin' | 'stop') => {
        setPlaceSearchMode(mode);
        setPlaceSearchQuery('');
        setPlaceSearchResults([]);
        setShowPlaceSearch(true);
    };

    const closePlaceSearch = () => {
        setShowPlaceSearch(false);
        setPlaceSearchQuery('');
        setPlaceSearchResults([]);
    };

    const handleSelectSearchPlace = (place: GeocodingPlace) => {
        if (placeSearchMode === 'origin') {
            onOriginChange?.(place);
        } else {
            const updated = [...waypoints, place];
            onWaypointsChange?.(updated);
        }
        closePlaceSearch();
    };

    const handleUseMyLocation = () => {
        onOriginChange?.(null);
        closePlaceSearch();
    };

    const handleRemoveStop = (index: number) => {
        const updated = waypoints.filter((_, i) => i !== index);
        onWaypointsChange?.(updated);
    };

    return (
        <>
            <View
                className="rounded-3xl shadow-lg overflow-hidden"
                style={{ backgroundColor: theme.surface }}
            >
                <View className="flex-row items-start px-4 py-3">
                    <TouchableOpacity
                        onPress={onClose}
                        className="mr-3 mt-0"
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
                    </TouchableOpacity>

                    <View className="flex-1">
                        <View className="flex-row items-center mb-2">
                            <View className="w-4 h-4 rounded-full mr-3" style={{ backgroundColor: theme.blue }} />
                            <TouchableOpacity
                                className="flex-1 flex-row items-center justify-between"
                                onPress={() => openPlaceSearch('origin')}
                                activeOpacity={0.7}
                            >
                                <Text className="font-medium flex-1" style={{ color: theme.textPrimary }} numberOfLines={1}>
                                    {origin ? origin.name : t('your-location')}
                                </Text>
                                <Ionicons name="ellipsis-horizontal" size={20} color={theme.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        <View className="flex-row items-center">
                            <View className="w-4 items-center mr-3">
                                <View style={{ width: 2, height: 16, backgroundColor: theme.border }}>
                                    <View style={{
                                        position: 'absolute',
                                        left: 0,
                                        right: 0,
                                        top: 0,
                                        bottom: 0,
                                        borderLeftWidth: 2,
                                        borderColor: theme.border,
                                        borderStyle: 'dotted',
                                    }} />
                                </View>
                            </View>
                        </View>

                        {waypoints.map((wp, index) => (
                            <View key={index}>
                                <View className="flex-row items-center mb-2">
                                    <Image
                                        source={require('../../../../assets/images/location-pin-2.png')}
                                        style={{ width: 16, height: 16, marginRight: 12 }}
                                        resizeMode="contain"
                                    />
                                    <Text className="font-medium flex-1" style={{ color: theme.textPrimary }} numberOfLines={1}>
                                        {wp.name}
                                    </Text>
                                    <TouchableOpacity
                                        onPress={() => handleRemoveStop(index)}
                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    >
                                        <Ionicons name="close" size={20} color={theme.textSecondary} />
                                    </TouchableOpacity>
                                </View>
                                <View className="flex-row items-center">
                                    <View className="w-4 items-center mr-3">
                                        <View style={{ width: 2, height: 16, backgroundColor: theme.border }}>
                                            <View style={{
                                                position: 'absolute',
                                                left: 0,
                                                right: 0,
                                                top: 0,
                                                bottom: 0,
                                                borderLeftWidth: 2,
                                                borderColor: theme.border,
                                                borderStyle: 'dotted',
                                            }} />
                                        </View>
                                    </View>
                                </View>
                            </View>
                        ))}

                        {transportMode !== 'taxi' && (
                            <>
                                <View className="flex-row items-center mb-2">
                                    <View
                                        className="w-4 h-4 rounded-full mr-3 items-center justify-center"
                                        style={{ backgroundColor: theme.primaryMuted }}
                                    >
                                        <Ionicons name="add" size={12} color={colors.primary.main} />
                                    </View>
                                    <TouchableOpacity
                                        className="flex-1"
                                        onPress={() => openPlaceSearch('stop')}
                                        activeOpacity={0.7}
                                    >
                                        <Text className="font-medium" style={{ color: colors.primary.main }}>
                                            {t('add-stop')}
                                        </Text>
                                    </TouchableOpacity>
                                </View>

                                <View className="flex-row items-center">
                                    <View className="w-4 items-center mr-3">
                                        <View style={{ width: 2, height: 16, backgroundColor: theme.border }}>
                                            <View style={{
                                                position: 'absolute',
                                                left: 0,
                                                right: 0,
                                                top: 0,
                                                bottom: 0,
                                                borderLeftWidth: 2,
                                                borderColor: theme.border,
                                                borderStyle: 'dotted',
                                            }} />
                                        </View>
                                    </View>
                                </View>
                            </>
                        )}

                        <View className="flex-row items-center">
                            <Ionicons name="location" size={20} color={colors.primary.main} className="mr-3" />
                            <Text className="font-semibold flex-1" style={{ color: theme.textPrimary }} numberOfLines={1}>
                                {destination?.name || t('choose-destination')}
                            </Text>
                        </View>
                    </View>
                </View>
            </View>

            <Modal
                visible={showPlaceSearch}
                animationType="slide"
                transparent
                onRequestClose={closePlaceSearch}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'position' : undefined}
                    style={{ flex: 1 }}
                    keyboardVerticalOffset={0}
                >
                    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
                        <View style={{
                            backgroundColor: theme.background,
                            borderTopLeftRadius: 24,
                            borderTopRightRadius: 24,
                            borderBottomLeftRadius: 24,
                            borderBottomRightRadius: 24,
                            paddingBottom: 16,
                            overflow: 'hidden',
                            marginHorizontal: 16,
                            marginBottom: insets.bottom > 0 ? insets.bottom : 16
                        }}>
                            <View style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                paddingHorizontal: 20,
                                paddingTop: 20,
                                paddingBottom: 12
                            }}>
                                <Text style={{ fontSize: 18, fontWeight: '700', color: theme.textPrimary, flex: 1 }}>
                                    {placeSearchMode === 'origin' ? t('set-starting-point') : t('add-a-stop')}
                                </Text>
                                <TouchableOpacity
                                    onPress={closePlaceSearch}
                                    style={{
                                        width: 36,
                                        height: 36,
                                        borderRadius: 18,
                                        backgroundColor: isDark ? theme.surface : '#F3F4F6',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}
                                >
                                    <Ionicons name="close" size={20} color={theme.textPrimary} />
                                </TouchableOpacity>
                            </View>

                            {placeSearchMode === 'origin' && (
                                <TouchableOpacity
                                    onPress={handleUseMyLocation}
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        marginHorizontal: 20,
                                        marginBottom: 8,
                                        paddingVertical: 14,
                                        borderBottomWidth: 1,
                                        borderBottomColor: theme.border,
                                    }}
                                    activeOpacity={0.7}
                                >
                                    <View style={{
                                        width: 36,
                                        height: 36,
                                        borderRadius: 18,
                                        backgroundColor: theme.primaryMuted,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        marginRight: 14,
                                    }}>
                                        <Ionicons name="locate" size={18} color={colors.primary.main} />
                                    </View>
                                    <Text style={{ fontSize: 14, fontWeight: '600', color: theme.textPrimary }}>
                                        {t('your-location')}
                                    </Text>
                                </TouchableOpacity>
                            )}

                            <TouchableOpacity
                                onPress={() => {
                                    closePlaceSearch();
                                    router.push({
                                        pathname: '/places/map-picker',
                                        params: {
                                            mode: placeSearchMode,
                                        }
                                    });
                                }}
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    marginHorizontal: 20,
                                    marginBottom: 8,
                                    paddingVertical: 14,
                                    borderBottomWidth: 1,
                                    borderBottomColor: theme.border,
                                }}
                                activeOpacity={0.7}
                            >
                                <View style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: 18,
                                    backgroundColor: theme.primaryMuted,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginRight: 14,
                                }}>
                                    <Ionicons name="map-outline" size={18} color={colors.primary.main} />
                                </View>
                                <Text style={{ fontSize: 14, fontWeight: '600', color: theme.textPrimary }}>
                                    {placeSearchMode === 'origin' ? t('pick-on-map') : t('pick-stop-on-map')}
                                </Text>
                            </TouchableOpacity>

                            <View style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                marginHorizontal: 20,
                                marginBottom: 8,
                                backgroundColor: isDark ? theme.surface : '#F3F4F6',
                                borderRadius: 14,
                                paddingHorizontal: 14,
                                paddingVertical: 10
                            }}>
                                <Ionicons name="search" size={18} color={theme.textSecondary} />
                                <TextInput
                                    autoFocus
                                    placeholder={placeSearchMode === 'origin' ? t('search-starting-point') : t('search-for-a-place')}
                                    placeholderTextColor={theme.textSecondary}
                                    value={placeSearchQuery}
                                    onChangeText={handlePlaceSearchChange}
                                    style={{ flex: 1, marginLeft: 10, fontSize: 15, color: theme.textPrimary }}
                                    returnKeyType="search"
                                />
                                {placeSearchQuery.length > 0 && (
                                    <TouchableOpacity onPress={() => {
                                        setPlaceSearchQuery('');
                                        setPlaceSearchResults([]);
                                    }}>
                                        <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
                                    </TouchableOpacity>
                                )}
                            </View>

                            {isSearchingPlace ? (
                                <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                                    <ActivityIndicator size="small" color={colors.primary.main} />
                                </View>
                            ) : (
                                <FlatList
                                    data={placeSearchResults}
                                    keyExtractor={(_, i) => i.toString()}
                                    style={{ maxHeight: 320 }}
                                    keyboardShouldPersistTaps="handled"
                                    ListEmptyComponent={
                                        placeSearchQuery.length >= 2 ? (
                                            <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                                                <Text style={{ color: theme.textSecondary, fontSize: 14 }}>
                                                    {t('no-results-found')}
                                                </Text>
                                            </View>
                                        ) : null
                                    }
                                    renderItem={({ item }) => (
                                        <TouchableOpacity
                                            onPress={() => handleSelectSearchPlace(item)}
                                            style={{
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                paddingHorizontal: 20,
                                                paddingVertical: 14,
                                                borderTopWidth: 1,
                                                borderTopColor: theme.border
                                            }}
                                            activeOpacity={0.7}
                                        >
                                            <View style={{
                                                width: 36,
                                                height: 36,
                                                borderRadius: 18,
                                                backgroundColor: theme.primaryMuted,
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                marginRight: 14
                                            }}>
                                                <Ionicons name="location-outline" size={18} color={colors.primary.main} />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text
                                                    style={{ fontSize: 14, fontWeight: '600', color: theme.textPrimary }}
                                                    numberOfLines={1}
                                                >
                                                    {item.name}
                                                </Text>
                                                <Text
                                                    style={{ fontSize: 12, color: theme.textSecondary, marginTop: 2 }}
                                                    numberOfLines={1}
                                                >
                                                    {[item.City, item.Country].filter(Boolean).join(', ')}
                                                </Text>
                                            </View>
                                        </TouchableOpacity>
                                    )}
                                />
                            )}
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </>
    );
};
