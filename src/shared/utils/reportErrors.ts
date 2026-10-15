import { isRestrictedError } from './apiErrors';
import { showToast } from './toast';

type Translate = (key: string) => string;

const RATE_LIMIT_PATTERN = /too many|every \d+ minute|once every|rate limit/i;

export const isReportRateLimited = (message?: string, status?: number): boolean =>
    status === 429 || (!!message && RATE_LIMIT_PATTERN.test(message));

export const getReportErrorMessage = (t: Translate, message?: string, status?: number): string =>
    isReportRateLimited(message, status) ? t('report-rate-limited') : t('report-failed');

// E0017 already shows a global toast; callers skip their own
export const showReportError = (t: Translate, error: { message?: string; status?: number; code?: string }) => {
    if (isRestrictedError(error.code)) return;
    showToast(getReportErrorMessage(t, error.message, error.status));
};

export const reportErrorFrom = (error: unknown): { message?: string; status?: number; code?: string } => ({
    message: error instanceof Error ? error.message : undefined,
    status: (error as { status?: number } | null)?.status,
    code: (error as { code?: string } | null)?.code,
});
