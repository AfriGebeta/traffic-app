import { LocalizedText } from '../types/campaign.types';

// campaign names may come as a plain string or { en, am }; either side can be empty
export const pickLocalized = (text: LocalizedText | null | undefined, language: string): string => {
    if (!text) return '';
    if (typeof text === 'string') return text;
    const order = language.startsWith('am') ? [text.am, text.en] : [text.en, text.am];
    return order.find((value) => typeof value === 'string' && value.trim().length > 0) ?? '';
};
