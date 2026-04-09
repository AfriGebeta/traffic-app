import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Pressable, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../../shared/theme/colors';
import type { SavedPlaceType } from '../types/place.types';
import { useTranslation } from '../../../shared/hooks/useTranslation';

interface SavePlaceModalProps {
    visible: boolean;
    onClose: () => void;
    onSave: (type: SavedPlaceType, label: string, isPrivate: boolean) => void;
    placeName?: string;
}

export const SavePlaceModal: React.FC<SavePlaceModalProps> = ({
    visible,
    onClose,
    onSave,
    placeName,
}) => {
    const insets = useSafeAreaInsets();
    const { t } = useTranslation();
    const [selectedType, setSelectedType] = useState<SavedPlaceType>('FAVORITE');
    const [label, setLabel] = useState(placeName || '');
    const [isPrivate, setIsPrivate] = useState(false);

    const placeTypes: { type: SavedPlaceType; icon: string; label: string }[] = [
        { type: 'HOME', icon: 'home', label: t('home') },
        { type: 'WORK', icon: 'briefcase', label: t('work') },
        { type: 'FAVORITE', icon: 'heart', label: t('favorites') },
    ];

    const handleSave = () => {
        if (label.trim()) {
            onSave(selectedType, label.trim(), isPrivate);
            onClose();
            setLabel('');
            setSelectedType('FAVORITE');
            setIsPrivate(false);
        }
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <Pressable
                className="flex-1 justify-end bg-black/50"
                onPress={onClose}
            >
                <Pressable
                    className="bg-white rounded-t-3xl p-6"
                    style={{ paddingBottom: insets.bottom + 24 }}
                    onPress={(e) => e.stopPropagation()}
                >
                    <View className="w-12 h-1 bg-gray-300 rounded-full self-center mb-4" />

                    <Text className="text-2xl font-bold text-gray-900 mb-6">
                        {t('save-place')}
                    </Text>

                    <Text className="text-sm font-semibold text-gray-700 mb-3">
                        {t('place-type')}
                    </Text>
                    <View className="flex-row mb-6 gap-3">
                        {placeTypes.map((type) => (
                            <TouchableOpacity
                                key={type.type}
                                onPress={() => setSelectedType(type.type)}
                                className={`flex-1 p-4 rounded-xl border-2 ${selectedType === type.type
                                    ? 'border-orange-500 bg-orange-50'
                                    : 'border-gray-200 bg-white'
                                    }`}
                            >
                                <Ionicons
                                    name={type.icon as any}
                                    size={24}
                                    color={selectedType === type.type ? colors.primary.main : '#6B7280'}
                                />
                                <Text
                                    className={`text-sm font-medium mt-2 ${selectedType === type.type ? 'text-orange-600' : 'text-gray-600'
                                        }`}
                                >
                                    {type.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <Text className="text-sm font-semibold text-gray-700 mb-3">
                        {t('label')}
                    </Text>
                    <TextInput
                        value={label}
                        onChangeText={setLabel}
                        placeholder={t('enter-place-name')}
                        className="bg-gray-50 rounded-xl px-4 py-3 text-base text-gray-900 mb-6"
                        placeholderTextColor="#9CA3AF"
                    />

                    <TouchableOpacity
                        onPress={() => setIsPrivate(!isPrivate)}
                        className="flex-row items-center justify-between mb-6"
                    >
                        <View className="flex-1">
                            <Text className="text-base font-semibold text-gray-900">
                                {t('private-place')}
                            </Text>
                            <Text className="text-sm text-gray-500 mt-1">
                                {t('only-you-can-see')}
                            </Text>
                        </View>
                        <View
                            className={`w-12 h-7 rounded-full justify-center ${isPrivate ? '' : 'bg-gray-300'
                                }`}
                            style={isPrivate ? { backgroundColor: colors.primary.main } : undefined}
                        >
                            <View
                                className={`w-5 h-5 rounded-full bg-white ${isPrivate ? 'ml-6' : 'ml-1'
                                    }`}
                            />
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={handleSave}
                        disabled={!label.trim()}
                        style={{
                            backgroundColor: label.trim() ? colors.primary.main : '#D1D5DB',
                        }}
                        className="rounded-xl py-4 px-4 flex-row items-center justify-center"
                    >
                        <Ionicons name="bookmark" size={20} color="#fff" />
                        <Text className="text-white font-semibold text-base ml-2">
                            {t('save-place')}
                        </Text>
                    </TouchableOpacity>
                </Pressable>
            </Pressable>
        </Modal>
    );
};
