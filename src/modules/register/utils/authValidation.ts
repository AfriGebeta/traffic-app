import type { TFunction } from 'i18next';

export const MIN_PASSWORD_LENGTH = 6;

export const LOCAL_PHONE_PATTERN = /^[79]\d{8}$/;

export function toLocalPhone(fullNumber?: string | null): string {
    const digits = (fullNumber || '').replace(/\D/g, '');
    if (!digits) return '';

    const withoutCountry = digits.startsWith('251') ? digits.slice(3) : digits;
    return withoutCountry.replace(/^0+/, '').slice(-9);
}

export function toFullPhone(local: string): string {
    return `+251${local.trim()}`;
}

export function validateLocalPhone(t: TFunction, local: string): string | null {
    const value = local.trim();

    if (!value) return t('error-enter-phone-number');
    if (!LOCAL_PHONE_PATTERN.test(value)) return t('error-phone-format');

    return null;
}

export function validateName(t: TFunction, name: string): string | null {
    const value = name.trim();

    if (!value) return t('error-enter-name');
    if (value.length < 2) return t('error-name-too-short');

    return null;
}

export function validatePassword(t: TFunction, password: string): string | null {
    if (!password) return t('error-enter-password');
    if (password.length < MIN_PASSWORD_LENGTH) return t('error-password-too-short');

    return null;
}
