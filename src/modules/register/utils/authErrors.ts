import type { TFunction } from 'i18next';

export type AuthErrorCode =
    | 'INVALID_CREDENTIALS'
    | 'USER_NOT_FOUND'
    | 'ALREADY_REGISTERED'
    | 'INVALID_INPUT'
    | 'TOO_MANY_ATTEMPTS'
    | 'BANNED'
    | 'NETWORK'
    | 'SERVER'
    | 'UNKNOWN';

export type AuthContext = 'login' | 'register' | 'profile';
export function classifyAuthError(raw?: string, status?: number): AuthErrorCode {
    const text = (raw || '').toLowerCase();

    if (status === 401 || status === 403) {
        return text.includes('ban') ? 'BANNED' : 'INVALID_CREDENTIALS';
    }
    if (status === 404) return 'USER_NOT_FOUND';
    if (status === 409) return 'ALREADY_REGISTERED';
    if (status === 400 || status === 422) return 'INVALID_INPUT';
    if (status === 429) return 'TOO_MANY_ATTEMPTS';
    if (status && status >= 500) return 'SERVER';

    if (!text) return 'UNKNOWN';

    if (text.includes('network') || text.includes('failed to fetch') || text.includes('timeout')) {
        return 'NETWORK';
    }
    if (text.includes('ban')) return 'BANNED';
    if (text.includes('already') || text.includes('exist') || text.includes('duplicate') || text.includes('registered')) {
        return 'ALREADY_REGISTERED';
    }
    if (text.includes('not found') || text.includes('does not exist') || text.includes('no user')) {
        return 'USER_NOT_FOUND';
    }
    if (text.includes('password') || text.includes('credential') || text.includes('unauthor')) {
        return 'INVALID_CREDENTIALS';
    }
    if (text.includes('invalid') || text.includes('validation') || text.includes('required')) {
        return 'INVALID_INPUT';
    }

    return 'UNKNOWN';
}

export function authErrorMessage(t: TFunction, code: AuthErrorCode, context: AuthContext): string {
    switch (code) {
        case 'INVALID_CREDENTIALS':
            return t('error-wrong-phone-or-password');
        case 'USER_NOT_FOUND':
            return t('error-no-account-for-number');
        case 'ALREADY_REGISTERED':
            return context === 'register' ? t('error-number-already-registered') : t('error-number-in-use');
        case 'INVALID_INPUT':
            return t('error-check-your-details');
        case 'TOO_MANY_ATTEMPTS':
            return t('error-too-many-attempts');
        case 'BANNED':
            return t('error-account-suspended');
        case 'NETWORK':
            return t('error-no-connection');
        case 'SERVER':
            return t('error-server-busy');
        default:
            return t('error-something-went-wrong');
    }
}

export function toFriendlyAuthError(
    t: TFunction,
    context: AuthContext,
    raw?: string,
    status?: number
): { code: AuthErrorCode; message: string } {
    const code = classifyAuthError(raw, status);

    if (code === 'UNKNOWN' && raw) {
        console.log('auth error unmapped', { context, status, raw });
    }

    return { code, message: authErrorMessage(t, code, context) };
}
