import React from 'react';
import { View, Text, TouchableOpacity, Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useMapTheme, MapTheme } from '../context/MapThemeContext';

interface MapThemeSelectorProps {
    visible: boolean;
    onClose: () => void;
}

export const MapThemeSelector: React.FC<MapThemeSelectorProps> = ({
    visible,
    onClose,
}) => {
    const { t, i18n } = useTranslation();
    const { currentTheme, setTheme, themes } = useMapTheme();
    const isAmharic = i18n.language === 'am';

    const handleSelectTheme = (theme: MapTheme) => {
        setTheme(theme.id);
        onClose();
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <Pressable
                className="flex-1 bg-black/50 justify-end"
                onPress={onClose}
            >
                <Pressable
                    className="bg-white rounded-t-3xl p-6"
                    onPress={(e) => e.stopPropagation()}
                >
                    <View className="items-center mb-4">
                        <View className="w-12 h-1 bg-gray-300 rounded-full mb-4" />
                        <Text className="text-lg font-bold text-gray-800">
                            {t('map-style', 'Map Style')}
                        </Text>
                    </View>

                    <View className="flex-row justify-around mt-4 mb-6">
                        {themes.map((theme) => {
                            const isSelected = currentTheme.id === theme.id;
                            return (
                                <TouchableOpacity
                                    key={theme.id}
                                    onPress={() => handleSelectTheme(theme)}
                                    className={`items-center p-4 px-2 rounded-2xl ${isSelected ? 'bg-amber-100 border-2 border-amber-500' : 'bg-gray-100'
                                        }`}
                                    style={{ width: '30%' }}
                                >
                                    <View className={`w-12 h-12 rounded-xl items-center justify-center mb-2 ${isSelected ? 'bg-amber-500' : 'bg-gray-300'
                                        }`}>
                                        <Ionicons
                                            name={theme.icon as any}
                                            size={32}
                                            color={isSelected ? 'white' : '#6B7280'}
                                        />
                                    </View>
                                    <Text className={`font-semibold ${isSelected ? 'text-amber-700' : 'text-gray-600'
                                        }`}>
                                        {isAmharic ? theme.nameAmharic : theme.name}
                                    </Text>
                                    {isSelected && (
                                        <View className="absolute top-2 right-2">
                                            <Ionicons name="checkmark-circle" size={20} color="#F59E0B" />
                                        </View>
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    <TouchableOpacity
                        onPress={onClose}
                        className="bg-gray-100 rounded-full py-3 items-center"
                    >
                        <Text className="text-gray-600 font-semibold">
                            {t('close', 'Close')}
                        </Text>
                    </TouchableOpacity>
                </Pressable>
            </Pressable>
        </Modal>
    );
};
