import React, { useState } from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '../hooks/useTranslation';
import { changeLanguage } from '../utils/localization/i18n';
import { colors } from '../theme/colors';

const LANGUAGES = [
    { code: 'en' as const, label: 'English', flag: '🇬🇧' },
    { code: 'am' as const, label: 'አማርኛኛ', flag: '🇪🇹' },
];

export const LanguageSwitcher: React.FC = () => {
    const { language } = useTranslation();
    const [showDropdown, setShowDropdown] = useState(false);

    const currentLanguage = LANGUAGES.find(lang => lang.code === language) || LANGUAGES[0];

    const handleLanguageChange = async (lang: 'en' | 'am') => {
        await changeLanguage(lang);
        setShowDropdown(false);
    };

    return (
        <View className="relative">

            <TouchableOpacity
                className="flex-row items-center bg-white border-2 rounded-xl px-4 py-2 shadow-sm"
                style={{ borderColor: colors.gray[200] }}
                onPress={() => setShowDropdown(!showDropdown)}
            >
                <Text className="text-lg mr-1">{currentLanguage.flag}</Text>
                <Text className="font-semibold text-gray-800 mr-2">
                    {currentLanguage.label}
                </Text>
                <Ionicons
                    name={showDropdown ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={colors.gray[500]}
                />
            </TouchableOpacity>

            {/* Dropdown Menu */}
            {showDropdown && (
                <View
                    className="absolute top-12 right-0 bg-white border-2 rounded-xl shadow-lg overflow-hidden"
                    style={{ borderColor: colors.gray[200], minWidth: 150, zIndex: 1000 }}
                >
                    {LANGUAGES.map((lang) => (
                        <TouchableOpacity
                            key={lang.code}
                            className={`flex-row items-center px-4 py-3 ${lang.code === language ? 'bg-blue-50' : 'bg-white'
                                }`}
                            onPress={() => handleLanguageChange(lang.code)}
                        >
                            <Text className="text-lg mr-2">{lang.flag}</Text>
                            <Text
                                className={`font-semibold ${lang.code === language ? 'text-blue-500' : 'text-gray-700'
                                    }`}
                            >
                                {lang.label}
                            </Text>
                            {lang.code === language && (
                                <Ionicons
                                    name="checkmark"
                                    size={20}
                                    color={colors.primary.main}
                                    style={{ marginLeft: 'auto' }}
                                />
                            )}
                        </TouchableOpacity>
                    ))}
                </View>
            )}
        </View>
    );
};
