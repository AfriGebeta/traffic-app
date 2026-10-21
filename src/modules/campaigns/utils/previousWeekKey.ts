import { CampaignPeriodInfo } from '../types/campaign.types';

const DAY_MS = 24 * 60 * 60 * 1000;

// ISO-8601 week key ("2026-W42") for a UTC calendar day
const isoWeekKey = (ms: number): string => {
    const source = new Date(ms);
    const date = new Date(Date.UTC(source.getUTCFullYear(), source.getUTCMonth(), source.getUTCDate()));
    const day = date.getUTCDay() || 7;
    // the Thursday of this week decides the ISO year
    date.setUTCDate(date.getUTCDate() + 4 - day);
    const year = date.getUTCFullYear();
    const week = Math.ceil(((date.getTime() - Date.UTC(year, 0, 1)) / DAY_MS + 1) / 7);
    return `${year}-W${String(week).padStart(2, '0')}`;
};

// key of the week before the current weekly period; null in the campaign's first week.
// 3 days back from the start lands mid-previous-week whatever the backend's timezone is
export const previousWeekKey = (current: CampaignPeriodInfo | undefined, campaignStartsAt?: string): string | null => {
    if (!current?.start || !/^\d{4}-W\d{2}$/.test(current.key)) return null;
    const startMs = new Date(current.start).getTime();
    if (Number.isNaN(startMs)) return null;
    const campaignStartMs = campaignStartsAt ? new Date(campaignStartsAt).getTime() : NaN;
    if (!Number.isNaN(campaignStartMs) && startMs <= campaignStartMs) return null;
    return isoWeekKey(startMs - 3 * DAY_MS);
};
