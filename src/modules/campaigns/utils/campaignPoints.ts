import { Campaign, CampaignKind } from '../types/campaign.types';


const isThemeActive = (from: string, to: string, now: Date): boolean => {
    const start = new Date(from);
    // "to" is an inclusive date; treat a bare date as the end of that day
    const end = new Date(/^\d{4}-\d{2}-\d{2}$/.test(to) ? `${to}T23:59:59` : to);
    return !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && now >= start && now <= end;
};

const themeMultiplier = (campaign: Campaign, kind: CampaignKind, now: Date): number =>
    (campaign.pointsFormula?.themes ?? [])
        .filter((theme) => theme.kinds?.includes(kind) && isThemeActive(theme.from, theme.to, now))
        .reduce((multiplier, theme) => multiplier * (theme.multiplier || 1), 1);

export const scoresSubmissions = (campaign: Campaign): boolean =>
    !!campaign.boundary?.coordinates && (campaign.scoring ?? []).some((rule) => rule.event === 'SUBMISSION_VERIFIED');

// what a plain verified item of this kind earns right now; 0 = the kind doesn't count here
export const basePoints = (campaign: Campaign, kind: CampaignKind, now = new Date()): number => {
    if (!scoresSubmissions(campaign)) return 0;
    const base = campaign.pointsFormula?.base?.[kind] ?? 0;
    return base > 0 ? Math.round(base * themeMultiplier(campaign, kind, now)) : 0;
};

export interface SubmissionQuality {
    hasPhoto?: boolean;
    // all optional fields filled; the backend hasn't said which fields count yet, so callers pass false for now
    isComplete?: boolean;
}

export const estimatePoints = (campaign: Campaign, kind: CampaignKind, quality: SubmissionQuality, now = new Date()): number => {
    const base = basePoints(campaign, kind, now);
    if (base === 0) return 0;
    const factors = campaign.pointsFormula?.quality ?? {};
    // take the best tier that applies instead of stacking them
    const tiers = [factors.required ?? 1];
    if (quality.hasPhoto && factors.photo) tiers.push(factors.photo);
    if (quality.isComplete && factors.complete) tiers.push(factors.complete);
    return Math.round(base * Math.max(...tiers));
};
