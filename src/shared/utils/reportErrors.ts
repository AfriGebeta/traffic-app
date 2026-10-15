import { ApiErrorCode, getCampaignFailures, isRestrictedError } from './apiErrors';
import { showToast } from './toast';

type Translate = (key: string) => string;

const RATE_LIMIT_PATTERN = /too many|every \d+ minute|once every|rate limit/i;

export const isReportRateLimited = (message?: string, status?: number): boolean =>
    status === 429 || (!!message && RATE_LIMIT_PATTERN.test(message));

export const getReportErrorMessage = (t: Translate, message?: string, status?: number): string =>
    isReportRateLimited(message, status) ? t('report-rate-limited') : t('report-failed');

// E0017 already shows a global toast; callers skip their own
export interface ReportErrorInfo {
    message?: string;
    status?: number;
    code?: string;
    additional?: Record<string, any>;
}

export const showReportError = (t: Translate, error: ReportErrorInfo) => {
    if (isRestrictedError(error.code)) return;
    if (error.code === ApiErrorCode.CampaignRulesNotMet) {
        const failures = getCampaignFailures(error.additional);
        showToast(failures.length > 0 ? failures.join('\n') : t('campaign-rules-not-met'));
        return;
    }
    showToast(getReportErrorMessage(t, error.message, error.status));
};

export const reportErrorFrom = (error: unknown): ReportErrorInfo => ({
    message: error instanceof Error ? error.message : undefined,
    status: (error as { status?: number } | null)?.status,
    code: (error as { code?: string } | null)?.code,
    additional: (error as { additional?: Record<string, any> } | null)?.additional,
});
