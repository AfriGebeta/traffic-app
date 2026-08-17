import React, { useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    TextInput,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../../shared/theme/colors';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { useTranslation } from '../../../shared/hooks/useTranslation';
import { showToast } from '../../../shared/utils/toast';
import { placeService } from '../services/place.service';
import type { SavedPlaceType } from '../types/place.types';

const REQUIRES_ADDRESS: SavedPlaceType[] = ['HOME', 'WORK'];

export const SavePlaceScreen = () => {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { t } = useTranslation();
    const { colors: theme, isDark } = useTheme();
    const params = useLocalSearchParams();

    const lat = params.lat ? parseFloat(params.lat as string) : undefined;
    const lng = params.lng ? parseFloat(params.lng as string) : undefined;

    const [selectedType, setSelectedType] = useState<SavedPlaceType>('FAVORITE');
    const [label, setLabel] = useState((params.name as string) || '');
    const [isPrivate, setIsPrivate] = useState(false);
    const [saving, setSaving] = useState(false);

    const [country, setCountry] = useState('');
    const [region, setRegion] = useState('');
    const [city, setCity] = useState('');
    const [subCity, setSubCity] = useState('');
    const [woreda, setWoreda] = useState('');
    const [sefer, setSefer] = useState('');
    const [houseNumber, setHouseNumber] = useState('');
    const [floor, setFloor] = useState('');
    const [buildingTotalFloor, setBuildingTotalFloor] = useState('');

    const needsAddress = REQUIRES_ADDRESS.includes(selectedType);

    const placeTypes: { type: SavedPlaceType; icon: string; label: string }[] = [
        { type: 'HOME', icon: 'home', label: t('home') },
        { type: 'WORK', icon: 'briefcase', label: t('work') },
        { type: 'FAVORITE', icon: 'heart', label: t('favorites') },
    ];

    const canSave = label.trim().length > 0
        && (!needsAddress || (region.trim() && city.trim() && subCity.trim() && woreda.trim() && sefer.trim()));

    const handleSave = async () => {
        if (!canSave || saving) return;

        setSaving(true);
        try {
            await placeService.savePlace({
                type: selectedType,
                label: label.trim(),
                lat,
                lng,
                isPrivate,
                ...(needsAddress
                    ? {
                        country: country.trim() || 'Ethiopia',
                        region: region.trim(),
                        city: city.trim(),
                        subCity: subCity.trim(),
                        woreda: woreda.trim(),
                        sefer: sefer.trim(),
                        houseNumber: houseNumber.trim() || undefined,
                        floor: floor.trim() ? parseInt(floor, 10) : undefined,
                        buildingTotalFloor: buildingTotalFloor.trim() ? parseInt(buildingTotalFloor, 10) : undefined,
                    }
                    : {}),
            });
            showToast(t('place-saved-successfully'));
            router.back();
        } catch (error) {
            showToast(error instanceof Error ? error.message : t('failed-to-save-place'));
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
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder}
                keyboardType={keyboardType}
                className="rounded-xl px-4 py-3 text-base"
                style={{ backgroundColor: isDark ? theme.surface : '#F9FAFB', color: theme.textPrimary }}
                placeholderTextColor={theme.textSecondary}
                editable={!saving}
            />
        </View>
    );

    return (
        <KeyboardAvoidingView
            className="flex-1"
            style={{ backgroundColor: theme.background }}
            behavior="padding"
        >
            <View
                className="flex-row items-center px-6 pb-4"
                style={{ paddingTop: insets.top + 12 }}
            >
                <TouchableOpacity
                    onPress={() => router.back()}
                    disabled={saving}
                    className="w-8 h-8 items-center justify-center mr-2"
                >
                    <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
                </TouchableOpacity>
                <Text className="text-xl font-bold" style={{ color: theme.textPrimary }}>
                    {t('save-place')}
                </Text>
            </View>

            <ScrollView
                className="flex-1 px-6"
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                bounces={false}
                alwaysBounceVertical={false}
            >
                <Text className="text-sm font-semibold mb-3" style={{ color: theme.textPrimary }}>
                    {t('place-type')}
                </Text>
                <View className="flex-row mb-6 gap-3">
                    {placeTypes.map((type) => (
                        <TouchableOpacity
                            key={type.type}
                            onPress={() => setSelectedType(type.type)}
                            disabled={saving}
                            className="flex-1 p-4 rounded-xl border-2"
                            style={{
                                borderColor: selectedType === type.type ? colors.primary.main : theme.border,
                                backgroundColor: selectedType === type.type ? theme.primaryMuted : 'transparent',
                            }}
                        >
                            <Ionicons
                                name={type.icon as any}
                                size={24}
                                color={selectedType === type.type ? colors.primary.main : theme.textSecondary}
                            />
                            <Text
                                className="text-sm font-medium mt-2"
                                style={{ color: selectedType === type.type ? colors.primary.main : theme.textSecondary }}
                            >
                                {type.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {renderInput(t('label'), label, setLabel, t('enter-place-name'))}

                {needsAddress && (
                    <>
                        {renderInput(t('country'), country, setCountry, t('country-placeholder'))}
                        {renderInput(t('region'), region, setRegion, t('region-placeholder'))}
                        {renderInput(t('city'), city, setCity, t('city-placeholder'))}
                        {renderInput(t('subcity'), subCity, setSubCity, t('subcity-placeholder'))}
                        {renderInput(t('woreda'), woreda, setWoreda, t('woreda-placeholder'))}
                        {renderInput(t('sefer'), sefer, setSefer, t('sefer-placeholder'))}
                        {renderInput(t('house-number'), houseNumber, setHouseNumber, '42')}
                        {renderInput(t('floor-number'), floor, setFloor, '2', 'number-pad')}
                        {renderInput(t('building-total-floors'), buildingTotalFloor, setBuildingTotalFloor, '5', 'number-pad')}
                    </>
                )}

                <TouchableOpacity
                    onPress={() => setIsPrivate(!isPrivate)}
                    disabled={saving}
                    className="flex-row items-center justify-between mb-6"
                >
                    <View className="flex-1">
                        <Text className="text-base font-semibold" style={{ color: theme.textPrimary }}>
                            {t('private-place')}
                        </Text>
                        <Text className="text-sm mt-1" style={{ color: theme.textSecondary }}>
                            {t('only-you-can-see')}
                        </Text>
                    </View>
                    <View
                        className="w-12 h-7 rounded-full justify-center"
                        style={{ backgroundColor: isPrivate ? colors.primary.main : theme.border }}
                    >
                        <View className={`w-5 h-5 rounded-full bg-white ${isPrivate ? 'ml-6' : 'ml-1'}`} />
                    </View>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={handleSave}
                    disabled={!canSave || saving}
                    style={{ backgroundColor: canSave && !saving ? colors.primary.main : theme.border, marginBottom: insets.bottom + 24 }}
                    className="rounded-xl py-4 px-4 flex-row items-center justify-center"
                >
                    {saving ? (
                        <ActivityIndicator color="white" />
                    ) : (
                        <>
                            <Ionicons name="bookmark" size={20} color="#fff" />
                            <Text className="text-white font-semibold text-base ml-2">
                                {t('save-place')}
                            </Text>
                        </>
                    )}
                </TouchableOpacity>
            </ScrollView>
        </KeyboardAvoidingView>
    );
};
