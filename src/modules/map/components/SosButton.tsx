import React, { useState } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { useGlass } from '../../../shared/theme/glass';
import { GlassSheen } from '../../../shared/components/GlassSheen';
import { SosSheet } from './SosSheet';
import { SOS_ICON } from './sosIcons';

interface SosButtonProps {
    userLocation?: { lat: number; lng: number } | null;
}

export const SosButton: React.FC<SosButtonProps> = ({ userLocation }) => {
    const { t } = useTranslation();
    const { isDark } = useTheme();
    const glass = useGlass();
    const [open, setOpen] = useState(false);
    const Icon = isDark ? SOS_ICON.dark : SOS_ICON.light;

    return (
        <View className="mt-3 items-end">
            <TouchableOpacity
                onPress={() => setOpen(true)}
                accessibilityRole="button"
                accessibilityLabel={t('sos')}
                className="rounded-full p-3"
                style={glass.surface}
            >
                <GlassSheen />
                <Icon width={24} height={24} />
            </TouchableOpacity>
            <SosSheet visible={open} onClose={() => setOpen(false)} userLocation={userLocation} />
        </View>
    );
};
