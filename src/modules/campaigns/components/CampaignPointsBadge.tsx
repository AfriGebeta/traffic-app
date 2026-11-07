import React from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { useUserLocation } from '../../map/hooks/useUserLocation';
import { isParticipating, useCampaigns } from '../store/campaignStore';
import { findCampaignAt } from '../utils/campaignGeo';
import { basePoints } from '../utils/campaignPoints';
import { CampaignKind } from '../types/campaign.types';
import { FONT_MEDIUM, tint } from './CampaignUi';

export function CampaignPointsBadge({ kind }: { kind: CampaignKind }) {
    const { t } = useTranslation();
    const { colors: theme } = useTheme();
    const state = useCampaigns();
    const { userLocation } = useUserLocation();

    const participating = state.campaigns.filter(
        (campaign) => isParticipating(campaign, state) && basePoints(campaign, kind) > 0
    );
    if (participating.length === 0) return null;

    const here = userLocation ? findCampaignAt(participating, userLocation.lat, userLocation.lng) : participating[0];
    const points = here ? basePoints(here, kind) : 0;

    return (
        // chip: brand tint inside the campaign area, neutral outline outside it
        <View
            className="px-2 py-0.5"
            style={{ borderRadius: 4, backgroundColor: here ? tint(theme.primary) : theme.surface, borderWidth: 1, borderColor: here ? 'transparent' : theme.border }}
        >
            <Text className="text-xs" style={{ color: here ? theme.textPrimary : theme.textSecondary, fontFamily: here ? FONT_MEDIUM : undefined, fontVariant: ['tabular-nums'] }}>
                {here ? `${points}+ ${t('campaign-pts')}` : t('campaign-outside-area')}
            </Text>
        </View>
    );
}
