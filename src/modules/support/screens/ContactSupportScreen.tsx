import React, { useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from '../../../shared/hooks/useTranslation';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { colors } from '../../../shared/theme/colors';
import { showToast } from '../../../shared/utils/toast';
import { supportService, SupportCategory } from '../services/support.service';

const CATEGORIES: { key: SupportCategory; labelKey: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: 'feature', labelKey: 'support-category-feature', icon: 'bulb-outline' },
    { key: 'bug', labelKey: 'support-category-bug', icon: 'bug-outline' },
];

const MAX_MESSAGE_LENGTH = 2000;

export default function ContactSupportScreen() {
    const router = useRouter();
    const { t, language } = useTranslation();
    const insets = useSafeAreaInsets();
    const { colors: theme, isDark } = useTheme();
    const [category, setCategory] = useState<SupportCategory>('feature');
    const [message, setMessage] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const cardStyle = {
        backgroundColor: isDark ? '#1E1E1E' : '#FFFFFF',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: isDark ? 0.35 : 0.08,
        shadowRadius: 8,
        elevation: 3,
    };

    const trimmed = message.trim();
    const canSubmit = trimmed.length > 0 && !submitting;

    const handleSubmit = async () => {
        if (!canSubmit) return;
        setSubmitting(true);
        const response = await supportService.submit({ category, message: trimmed, locale: language });
        setSubmitting(false);

        if (response.error) {
            showToast(t('support-send-failed'));
            return;
        }

        showToast(t('support-sent'));
        router.back();
    };

    return (
        <KeyboardAvoidingView
            className="flex-1"
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ paddingTop: insets.top, backgroundColor: theme.background }}
        >
            <View className="px-4 py-4 flex-row items-center">
                <TouchableOpacity onPress={() => router.back()} className="mr-4" activeOpacity={0.7}>
                    <Ionicons name="arrow-back" size={26} color={theme.textPrimary} />
                </TouchableOpacity>
                <Text className="text-xl font-bold flex-1" style={{ color: theme.textPrimary }} numberOfLines={1}>
                    {t('contact-support')}
                </Text>
            </View>

            <ScrollView
                className="flex-1"
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 24 }}
            >
                <Text className="text-sm mb-5" style={{ color: theme.textSecondary }}>
                    {t('contact-support-intro')}
                </Text>

                <Text className="font-bold text-base mb-3" style={{ color: theme.textPrimary }}>
                    {t('support-category')}
                </Text>
                <View className="flex-row gap-2 mb-6">
                    {CATEGORIES.map(({ key, labelKey, icon }) => {
                        const isSelected = key === category;
                        return (
                            <TouchableOpacity
                                key={key}
                                activeOpacity={0.7}
                                onPress={() => setCategory(key)}
                                accessibilityRole="radio"
                                accessibilityState={{ selected: isSelected }}
                                className="flex-1 items-center py-3 px-2"
                                style={{
                                    ...cardStyle,
                                    borderWidth: isSelected ? 2 : 1,
                                    borderColor: isSelected ? colors.primary.main : cardStyle.borderColor,
                                }}
                            >
                                <Ionicons
                                    name={icon}
                                    size={20}
                                    color={isSelected ? colors.primary.main : theme.textSecondary}
                                />
                                <Text
                                    className={`text-xs mt-1.5 ${isSelected ? 'font-bold' : 'font-medium'}`}
                                    style={{ color: isSelected ? theme.textPrimary : theme.textSecondary }}
                                    numberOfLines={1}
                                >
                                    {t(labelKey)}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                <Text className="font-bold text-base mb-3" style={{ color: theme.textPrimary }}>
                    {t('support-message')}
                </Text>
                <View className="px-4 py-3 mb-1" style={cardStyle}>
                    <TextInput
                        value={message}
                        onChangeText={setMessage}
                        placeholder={t('support-message-placeholder')}
                        placeholderTextColor={theme.textSecondary}
                        multiline
                        maxLength={MAX_MESSAGE_LENGTH}
                        textAlignVertical="top"
                        editable={!submitting}
                        style={{ minHeight: 140, color: theme.textPrimary, fontSize: 14 }}
                    />
                </View>
                <Text className="text-xs text-right mb-6" style={{ color: theme.textSecondary }}>
                    {message.length}/{MAX_MESSAGE_LENGTH}
                </Text>

                <TouchableOpacity
                    onPress={handleSubmit}
                    disabled={!canSubmit}
                    activeOpacity={0.8}
                    className="py-4 items-center justify-center"
                    style={{
                        borderRadius: 12,
                        backgroundColor: colors.primary.main,
                        opacity: canSubmit ? 1 : 0.5,
                    }}
                >
                    {submitting ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text className="text-white font-semibold text-base">{t('support-send')}</Text>
                    )}
                </TouchableOpacity>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}
