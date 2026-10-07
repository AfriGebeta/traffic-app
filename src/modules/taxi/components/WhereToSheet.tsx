import React, { useEffect, useMemo, useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, ScrollView, Keyboard, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { TaxiNode } from '../types/taxi.types';
import { SHEET_MAX_STYLE } from '../../../shared/layout/modalStyles';

interface WhereToSheetProps {
    visible: boolean;
    stations: TaxiNode[];
    labelFor: (station: TaxiNode) => string;
    onSelect: (station: TaxiNode) => void;
    onSkip: () => void;
    onClose: () => void;
}

export default function WhereToSheet({
    visible,
    stations,
    labelFor,
    onSelect,
    onSkip,
    onClose,
}: WhereToSheetProps) {
    const { t } = useTranslation();
    const { colors: theme } = useTheme();
    const insets = useSafeAreaInsets();

    const [query, setQuery] = useState('');
    const [keyboardHeight, setKeyboardHeight] = useState(0);

    useEffect(() => {
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

        const showSub = Keyboard.addListener(showEvent, (event) => {
            setKeyboardHeight(event.endCoordinates.height);
        });
        const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));

        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, []);

    useEffect(() => {
        if (!visible) setQuery('');
    }, [visible]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return [];
        return stations
            .filter(station =>
                station.name.toLowerCase().includes(q) ||
                station.routeName?.toLowerCase().includes(q)
            )
            .slice(0, 10);
    }, [query, stations]);

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                <View
                    className="rounded-t-3xl px-4 pt-2"
                    style={[{
                        backgroundColor: theme.background,
                        paddingBottom: keyboardHeight > 0 ? keyboardHeight + 16 : insets.bottom + 24,
                    }, SHEET_MAX_STYLE]}
                >
                    <View className="flex-row items-center justify-between">
                        <Text className="text-xl" style={{ color: theme.textPrimary, fontFamily: 'PlusJakartaSans-Bold' }}>
                            {t('where-to')}
                        </Text>
                        <TouchableOpacity onPress={onClose} className="p-2">
                            <Ionicons name="close" size={24} color={theme.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    <View
                        className="flex-row items-center rounded-xl px-4 mt-3"
                        style={{ backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }}
                    >
                        <Ionicons name="location" size={20} color="#F97316" />
                        <TextInput
                            value={query}
                            onChangeText={setQuery}
                            autoFocus
                            placeholder={t('enter-destination-name')}
                            placeholderTextColor={theme.textSecondary}
                            className="flex-1 ml-2 py-3"
                            style={{ color: theme.textPrimary }}
                        />
                    </View>

                    {filtered.length > 0 && (
                        <ScrollView
                            style={{ maxHeight: 240 }}
                            className="mt-2 rounded-xl"
                            keyboardShouldPersistTaps="always"
                        >
                            {filtered.map((station) => (
                                <TouchableOpacity
                                    key={station.id}
                                    className="px-4 py-3"
                                    style={{ borderBottomWidth: 1, borderBottomColor: theme.border }}
                                    onPress={() => onSelect(station)}
                                >
                                    <Text className="font-semibold" style={{ color: theme.textPrimary }}>
                                        {labelFor(station)}
                                    </Text>
                                    {station.routeName && (
                                        <Text className="text-xs mt-1" style={{ color: theme.textSecondary }}>
                                            {station.routeName}
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    )}

                    <TouchableOpacity onPress={onSkip} className="py-3 mt-2" activeOpacity={0.7}>
                        <Text className="text-center font-semibold" style={{ color: theme.textSecondary }}>
                            {t('skip')}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}
