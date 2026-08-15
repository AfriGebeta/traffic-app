import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { changeLanguage } from '../../../shared/utils/localization/i18n';

export const LANGUAGE_SELECTION_PENDING_KEY = 'languageSelectionPending';

type LanguageCode = 'en' | 'am';

interface LanguageOption {
    code: LanguageCode;
    nativeLabel: string;
}

const LANGUAGES: LanguageOption[] = [
    { code: 'en', nativeLabel: 'English' },
    { code: 'am', nativeLabel: 'አማርኛ' },
];

export const SelectLanguageScreen: React.FC = () => {
    const router = useRouter();
    const { colors: theme } = useTheme();
    const insets = useSafeAreaInsets();
    const [selected, setSelected] = useState<LanguageCode>('en');
    const [isSaving, setIsSaving] = useState(false);

    const handleSelect = async (code: LanguageCode) => {
        setSelected(code);
        await changeLanguage(code);
    };

    const handleContinue = async () => {
        if (isSaving) return;
        setIsSaving(true);
        try {
            await changeLanguage(selected);
            await AsyncStorage.removeItem(LANGUAGE_SELECTION_PENDING_KEY);
            router.replace('/');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <View className="flex-1" style={{ backgroundColor: theme.background, paddingTop: insets.top }}>
            <View className="flex-1 px-8 justify-center">
                <Ionicons
                    name="language"
                    size={40}
                    color={theme.textPrimary}
                    style={{ marginBottom: 24 }}
                />

                <Text className="text-3xl font-bold mb-2" style={{ color: theme.textPrimary }}>
                    Choose your language
                </Text>
                <Text className="text-base mb-8" style={{ color: theme.textSecondary }}>
                    ቋንቋዎን ይምረጡ
                </Text>

                <View style={{ gap: 16 }}>
                    {LANGUAGES.map((lang) => {
                        const isActive = lang.code === selected;
                        return (
                            <TouchableOpacity
                                key={lang.code}
                                onPress={() => handleSelect(lang.code)}
                                activeOpacity={0.8}
                                className="flex-row items-center rounded-2xl px-5 py-5"
                                style={{
                                    backgroundColor: theme.surface,
                                    borderWidth: 2,
                                    borderColor: isActive ? theme.primary : theme.border,
                                }}
                            >
                                <Text
                                    className="flex-1 text-lg font-semibold"
                                    style={{ color: theme.textPrimary }}
                                >
                                    {lang.nativeLabel}
                                </Text>
                                {isActive && (
                                    <Ionicons
                                        name="checkmark-circle"
                                        size={22}
                                        color={theme.primary}
                                    />
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>

            <View className="px-8" style={{ paddingBottom: insets.bottom + 24 }}>
                <TouchableOpacity
                    onPress={handleContinue}
                    disabled={isSaving}
                    className="rounded-2xl py-4 items-center"
                    style={{ backgroundColor: theme.primary, opacity: isSaving ? 0.7 : 1 }}
                >
                    {isSaving ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text className="text-white text-lg font-bold">Continue</Text>
                    )}
                </TouchableOpacity>
                <Text
                    className="text-xs text-center mt-3"
                    style={{ color: theme.textSecondary }}
                >
                    You can change this later in your profile.
                </Text>
            </View>
        </View>
    );
};
