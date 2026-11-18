import { DAY_KEYS, DayKey, Hours } from '../types/business.types';

const DAY_BY_INDEX: DayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

const minutesOf = (hhmm: string): number | null => {
    const match = hhmm.trim().match(/^(\d{1,2}):(\d{2})$/);
    return match ? Number(match[1]) * 60 + Number(match[2]) : null;
};

const parseRange = (range: string | undefined): { open: number; close: number } | null => {
    if (!range || range === 'closed') return null;
    const [from, to] = range.split('-');
    const open = minutesOf(from ?? '');
    const close = minutesOf(to ?? '');
    return open === null || close === null ? null : { open, close };
};

export interface OpenState {
    open: boolean | null;
    today: string | null;
}

export const openState = (hours: Hours | null | undefined, now = new Date()): OpenState => {
    if (!hours || !Object.keys(hours).length) return { open: null, today: null };
    const day = DAY_BY_INDEX[now.getDay()];
    const yesterday = DAY_BY_INDEX[(now.getDay() + 6) % 7];
    const minute = now.getHours() * 60 + now.getMinutes();
    const todayRange = parseRange(hours[day]);
    const lateYesterday = parseRange(hours[yesterday]);
    const inToday = !!todayRange && (todayRange.close > todayRange.open ? minute >= todayRange.open && minute < todayRange.close : minute >= todayRange.open);
    const inYesterday = !!lateYesterday && lateYesterday.close < lateYesterday.open && minute < lateYesterday.close;
    return { open: inToday || inYesterday, today: hours[day] ?? null };
};

export const weekHours = (hours: Hours | null | undefined): { day: DayKey; value: string }[] =>
    hours ? DAY_KEYS.filter((day) => hours[day]).map((day) => ({ day, value: hours[day]! })) : [];

export const telegramHandle = (raw: string | null | undefined): string | null => {
    const handle = (raw ?? '')
        .trim()
        .replace(/^https?:\/\//i, '')
        .replace(/^(www\.)?t(elegram)?\.me\//i, '')
        .replace(/^@/, '')
        .split(/[/?#\s]/)[0];
    return /^[A-Za-z0-9_]{3,}$/.test(handle) ? handle : null;
};

export const websiteUrl = (raw: string | null | undefined): string | null => {
    const value = (raw ?? '').trim();
    if (!value) return null;
    return /^https?:\/\//i.test(value) ? value : `https://${value}`;
};

export const telUrl = (raw: string | null | undefined): string | null => {
    const digits = (raw ?? '').replace(/[^\d+]/g, '');
    return digits.length >= 7 ? `tel:${digits}` : null;
};
