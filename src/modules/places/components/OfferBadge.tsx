import React from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { FONT_MEDIUM, tint } from '../../campaigns/components/CampaignUi';

// "Offer" / "Code" / "Bundle" / "New" from the backend
export function OfferBadge({ badge }: { badge: string }) {
    const { t } = useTranslation();
    const { colors: theme } = useTheme();
    const color = badge === 'Code' ? theme.primary : badge === 'New' ? theme.blue : theme.green;
    return (
        <View style={{ borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: tint(color, '26') }}>
            <Text style={{ color, fontSize: 11, fontFamily: FONT_MEDIUM }}>{t(`offer-badge-${badge.toLowerCase()}`, { defaultValue: badge })}</Text>
        </View>
    );
}
