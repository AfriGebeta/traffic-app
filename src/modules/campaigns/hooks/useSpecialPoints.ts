import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { campaignService } from '../services/campaign.service';
import { hasCampaignEnded, useCampaigns } from '../store/campaignStore';
import { SpecialPoint } from '../types/campaign.types';

// bonuses from /api/special-points for campaigns the user joined and that are still running.
// refetched on every focus
export function useSpecialPoints() {
    const state = useCampaigns();
    const [rows, setRows] = useState<SpecialPoint[] | null>(null);

    useFocusEffect(
        useCallback(() => {
            let alive = true;
            campaignService
                .getSpecialPoints()
                .then((next) => {
                    if (alive) setRows(next);
                })
                .catch(() => {
                    if (alive) setRows((prev) => prev ?? []);
                });
            return () => {
                alive = false;
            };
        }, [])
    );

    const visible = (rows ?? []).filter((row) => {
        if (state.me[row.campaign.slug]?.joined !== true) return false;
        const campaign = state.campaigns.find((c) => c.slug === row.campaign.slug);
        return !campaign || !hasCampaignEnded(campaign);
    });

    return { visible };
}

// "+20 points" / "×1.5 points"; the bonus only, the real score also depends on photo quality etc.
export function useSpecialPointsLabel() {
    const { t } = useTranslation();
    return useCallback(
        (row: SpecialPoint) =>
            [
                row.multiplier ? t('special-points-multiplier', { value: row.multiplier }) : null,
                row.add ? t('special-points-add', { points: row.add }) : null,
            ]
                .filter(Boolean)
                .join(' · '),
        [t]
    );
}
