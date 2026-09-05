import { parsePhoneNumberFromString } from 'libphonenumber-js';

const DEFAULT_COUNTRY = 'ET';

export function toE164(input: string): string | null {
    const value = input.trim();
    if (!value) return null;

    const withPlus = /^251\d+$/.test(value.replace(/\s/g, '')) ? `+${value.replace(/\s/g, '')}` : value;
    const parsed = parsePhoneNumberFromString(withPlus, DEFAULT_COUNTRY);

    if (!parsed || !parsed.isValid()) return null;

    return parsed.number;
}

export function isValidPhone(input: string): boolean {
    return toE164(input) !== null;
}
