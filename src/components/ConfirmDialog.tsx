import React from 'react';
import { Modal, View, Text, TouchableOpacity } from 'react-native';
import { colors } from '../shared/theme/colors';
import { useTheme } from '../shared/theme/ThemeContext';

import DeleteLight from '../../assets/images/delete-light.svg';
import DeleteDark from '../../assets/images/delete-dark.svg';

interface ConfirmDialogProps {
    visible: boolean;
    title: string;
    message?: string;
    confirmLabel: string;
    cancelLabel: string;
    destructive?: boolean;
    showDeleteIcon?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

export const ConfirmDialog = ({
    visible,
    title,
    message,
    confirmLabel,
    cancelLabel,
    destructive = false,
    showDeleteIcon = false,
    onConfirm,
    onCancel,
}: ConfirmDialogProps) => {
    const { colors: theme, isDark } = useTheme();
    const accent = destructive ? colors.error.main : colors.primary.main;
    const DeleteIcon = isDark ? DeleteDark : DeleteLight;

    return (
        <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onCancel}>
            <View className="flex-1 items-center justify-center px-8" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
                <View
                    className="w-full rounded-2xl p-6 items-center"
                    style={{ backgroundColor: theme.background }}
                >
                    {showDeleteIcon && (
                        <View className="mb-4">
                            <DeleteIcon width={40} height={40} />
                        </View>
                    )}

                    <Text className="text-lg font-bold text-center" style={{ color: theme.textPrimary }}>
                        {title}
                    </Text>

                    {message && (
                        <Text
                            className="text-sm text-center leading-5 mt-2"
                            style={{ color: theme.textSecondary }}
                        >
                            {message}
                        </Text>
                    )}

                    <View className="flex-row gap-3 mt-6 w-full">
                        <TouchableOpacity
                            onPress={onCancel}
                            className="flex-1 rounded-xl py-3.5 items-center"
                            style={{ borderWidth: 1, borderColor: theme.border }}
                        >
                            <Text className="font-semibold text-base" style={{ color: theme.textPrimary }}>
                                {cancelLabel}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={onConfirm}
                            className="flex-1 rounded-xl py-3.5 items-center"
                            style={{ backgroundColor: accent }}
                        >
                            <Text className="text-white font-semibold text-base">{confirmLabel}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

export default ConfirmDialog;
