import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { colors } from '../../../shared/theme/colors';
import { FONT_MEDIUM, RADIUS, RADIUS_SM, tint } from '../../campaigns/components/CampaignUi';

export interface SelectOption<V extends string | number = string> {
    value: V;
    label: string;
    hint?: string;
    // action rows ("+ Add a new building") render in the brand colour
    accent?: boolean;
    // pinned under the list, outside the scroll, and never filtered out ("Not in a building", "+ Add")
    sticky?: boolean;
    icon?: React.ComponentProps<typeof Ionicons>['name'];
}

// looks like Input; opens a modal list. Tapping the chosen row again clears it when `clearable`
export function SelectField<V extends string | number>({
    title,
    placeholder,
    options,
    value,
    onChange,
    clearable,
    disabled,
    error,
    searchPlaceholder,
    emptyText,
}: {
    title: string;
    placeholder: string;
    options: SelectOption<V>[];
    value: V | null | undefined;
    onChange: (value: V | null) => void;
    clearable?: boolean;
    disabled?: boolean;
    error?: string;
    // shows a search box in the list
    searchPlaceholder?: string;
    emptyText?: string;
}) {
    const { colors: theme, isDark } = useTheme();
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const selected = options.find((option) => option.value === value);
    const searchable = !!searchPlaceholder;
    const needle = query.trim().toLowerCase();
    const listed = options.filter((option) => !option.sticky && (!needle || option.label.toLowerCase().includes(needle)));
    const pinned = options.filter((option) => option.sticky);
    const noMatches = needle.length > 0 && listed.length === 0;
    const close = () => {
        setOpen(false);
        setQuery('');
    };

    const renderRow = (option: SelectOption<V>) => {
        const isSelected = option.value === value;
        const tone = option.accent ? theme.primary : theme.textPrimary;
        return (
            <TouchableOpacity
                key={String(option.value)}
                onPress={() => {
                    onChange(isSelected && clearable ? null : option.value);
                    close();
                }}
                className="flex-row items-center px-5 py-3.5"
            >
                {!!option.icon && (
                    <View
                        className="w-8 h-8 items-center justify-center mr-3"
                        style={{ borderRadius: RADIUS_SM, backgroundColor: option.accent ? tint(theme.primary) : theme.surface, borderWidth: 1, borderColor: option.accent ? 'transparent' : theme.border }}
                    >
                        <Ionicons name={option.icon} size={16} color={option.accent ? theme.primary : theme.textSecondary} />
                    </View>
                )}
                <View className="flex-1">
                    <Text className="text-sm" style={{ color: tone, fontFamily: isSelected || option.accent || option.icon ? FONT_MEDIUM : undefined }}>
                        {option.label}
                    </Text>
                    {!!option.hint && (
                        <Text className="text-xs mt-0.5" style={{ color: theme.textSecondary }}>
                            {option.hint}
                        </Text>
                    )}
                </View>
                {isSelected && <Ionicons name="checkmark" size={18} color={theme.primary} />}
            </TouchableOpacity>
        );
    };

    return (
        <View>
            <TouchableOpacity
                onPress={() => setOpen(true)}
                activeOpacity={0.7}
                disabled={disabled}
                className="flex-row items-center border px-3.5"
                style={{
                    borderRadius: RADIUS_SM,
                    minHeight: 48,
                    borderColor: error ? theme.error : theme.border,
                    backgroundColor: isDark ? theme.surface : colors.gray[50],
                    opacity: disabled ? 0.5 : 1,
                }}
            >
                <Text className="flex-1" style={{ fontSize: 15, color: selected ? theme.textPrimary : theme.textSecondary }} numberOfLines={1}>
                    {selected ? selected.label : placeholder}
                </Text>
                <Ionicons name="chevron-down" size={18} color={theme.textSecondary} />
            </TouchableOpacity>
            {!!error && (
                <Text className="text-xs mt-1" style={{ color: theme.error }}>
                    {error}
                </Text>
            )}

            <Modal visible={open} transparent animationType="fade" statusBarTranslucent onRequestClose={close}>
                {/* searchable lists sit higher so the keyboard doesn't cover them */}
                <Pressable
                    className={`flex-1 items-center px-6 ${searchable ? 'justify-start' : 'justify-center'}`}
                    style={{ backgroundColor: 'rgba(0,0,0,0.6)', paddingTop: searchable ? 80 : 0 }}
                    onPress={close}
                >
                    <Pressable className="w-full py-2" style={{ borderRadius: RADIUS, backgroundColor: theme.background, maxWidth: 480, borderWidth: 1, borderColor: theme.border }}>
                        <Text className="px-5 pt-3 pb-2" style={{ color: theme.textPrimary, fontFamily: FONT_MEDIUM, fontSize: 16 }}>
                            {title}
                        </Text>
                        {searchable && (
                            <View
                                className="flex-row items-center mx-5 mb-2 px-3"
                                style={{ borderRadius: RADIUS_SM, borderWidth: 1, borderColor: theme.border, backgroundColor: isDark ? theme.surface : colors.gray[50], minHeight: 42 }}
                            >
                                <Ionicons name="search" size={16} color={theme.textSecondary} />
                                <TextInput
                                    className="flex-1 ml-2"
                                    style={{ color: theme.textPrimary, fontSize: 15 }}
                                    placeholder={searchPlaceholder}
                                    placeholderTextColor={theme.textSecondary}
                                    value={query}
                                    onChangeText={setQuery}
                                    autoCorrect={false}
                                />
                                {!!query && (
                                    <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
                                        <Ionicons name="close-circle" size={16} color={theme.textSecondary} />
                                    </TouchableOpacity>
                                )}
                            </View>
                        )}
                        {noMatches && !!emptyText && (
                            <Text className="px-5 py-2 text-sm" style={{ color: theme.textSecondary }}>
                                {emptyText}
                            </Text>
                        )}
                        <ScrollView style={{ maxHeight: searchable ? (pinned.length ? 280 : 360) : 440 }} keyboardShouldPersistTaps="handled">
                            {listed.map(renderRow)}
                        </ScrollView>
                        {pinned.length > 0 && <View style={{ borderTopWidth: 1, borderTopColor: theme.border }}>{pinned.map(renderRow)}</View>}
                    </Pressable>
                </Pressable>
            </Modal>
        </View>
    );
}

// wrap of toggle chips; single or multi select
export function ChipSelect<V extends string>({
    options,
    selected,
    onToggle,
}: {
    options: SelectOption<V>[];
    selected: V[];
    onToggle: (value: V) => void;
}) {
    const { colors: theme } = useTheme();
    return (
        <View className="flex-row flex-wrap gap-2">
            {options.map((option) => {
                const on = selected.includes(option.value);
                return (
                    <TouchableOpacity
                        key={option.value}
                        onPress={() => onToggle(option.value)}
                        activeOpacity={0.7}
                        className="flex-row items-center px-3 py-2"
                        style={{
                            borderRadius: 999,
                            borderWidth: 1,
                            borderColor: on ? theme.primary : theme.border,
                            backgroundColor: on ? tint(theme.primary) : theme.surface,
                        }}
                    >
                        {on && <Ionicons name="checkmark" size={14} color={theme.primary} style={{ marginRight: 4 }} />}
                        <Text className="text-sm" style={{ color: theme.textPrimary, fontFamily: on ? FONT_MEDIUM : undefined }}>
                            {option.label}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}

// boxed sub-section inside a long form ("More details", "Offer 1", ...)
export function FormSection({ title, subtitle, right, children }: { title: string; subtitle?: string; right?: React.ReactNode; children: React.ReactNode }) {
    const { colors: theme } = useTheme();
    return (
        <View className="p-4" style={{ borderRadius: RADIUS, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface }}>
            <View className="flex-row items-start mb-3">
                <View className="flex-1">
                    <Text style={{ color: theme.textPrimary, fontFamily: FONT_MEDIUM, fontSize: 15 }}>{title}</Text>
                    {!!subtitle && (
                        <Text className="text-xs mt-0.5" style={{ color: theme.textSecondary }}>
                            {subtitle}
                        </Text>
                    )}
                </View>
                {right}
            </View>
            <View className="gap-4">{children}</View>
        </View>
    );
}

export const toggleIn = <V,>(list: V[], value: V): V[] => (list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
