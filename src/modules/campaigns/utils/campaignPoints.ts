import { Campaign, CampaignKind } from '../types/campaign.types';


const isThemeActive = (from: string, to: string, now: Date): boolean => {
    const start = new Date(from);
    // "to" is an inclusive date; treat a bare date as the end of that day
    const end = new Date(/^\d{4}-\d{2}-\d{2}$/.test(to) ? `${to}T23:59:59` : to);
    return !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && now >= start && now <= end;
};

// a theme with categories only counts for those place categories (slugs); without a category nothing matches it
const activeThemes = (campaign: Campaign, kind: CampaignKind, category: string | undefined, now: Date) =>
    (campaign.pointsFormula?.themes ?? []).filter(
        (theme) =>
            theme.kinds?.includes(kind) &&
            isThemeActive(theme.from, theme.to, now) &&
            (!theme.categories?.length || (!!category && theme.categories.includes(category)))
    );

export const scoresSubmissions = (campaign: Campaign): boolean =>
    !!campaign.boundary?.coordinates && (campaign.scoring ?? []).some((rule) => rule.event === 'SUBMISSION_VERIFIED');

// what a plain verified item of this kind earns right now (themes: multipliers, then `add`); 0 = the kind doesn't count here
export const basePoints = (campaign: Campaign, kind: CampaignKind, now = new Date(), category?: string): number => {
    if (!scoresSubmissions(campaign)) return 0;
    const base = campaign.pointsFormula?.base?.[kind] ?? 0;
    if (base <= 0) return 0;
    const themes = activeThemes(campaign, kind, category, now);
    const multiplied = themes.reduce((points, theme) => points * (theme.multiplier || 1), base);
    return Math.round(themes.reduce((points, theme) => points + (theme.add || 0), multiplied));
};

export interface SubmissionQuality {
    hasPhoto?: boolean;
    isComplete?: boolean;
    // place category slug, for themes limited to some categories (e.g. condominium, building)
    category?: string;
}

export const estimatePoints = (campaign: Campaign, kind: CampaignKind, quality: SubmissionQuality, now = new Date()): number => {
    const base = basePoints(campaign, kind, now, quality.category);
    if (base === 0) return 0;
    const factors = campaign.pointsFormula?.quality ?? {};
    // take the best tier that applies instead of stacking them
    const tiers = [factors.required ?? 1];
    if (quality.hasPhoto && factors.photo) tiers.push(factors.photo);
    if (quality.isComplete && factors.complete) tiers.push(factors.complete);
    return Math.round(base * Math.max(...tiers));
};
