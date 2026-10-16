import React from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors } from '../../../shared/theme/colors';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { useUserLocation } from '../../map/hooks/useUserLocation';
import { isParticipating, useCampaigns } from '../store/campaignStore';
import { findCampaignAt } from '../utils/campaignGeo';
import { basePoints } from '../utils/campaignPoints';
import { CampaignKind } from '../types/campaign.types';

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
        <View
            className="rounded-full px-2.5 py-1"
            style={{ backgroundColor: here ? theme.primaryMuted : theme.surface, borderWidth: here ? 0 : 1, borderColor: theme.border }}
        >
            <Text className="text-xs font-bold" style={{ color: here ? colors.primary.main : theme.textSecondary }}>
                {here ? `${points}+ ${t('campaign-pts')}` : t('campaign-outside-area')}
            </Text>
        </View>
    );
}
