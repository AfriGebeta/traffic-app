type Translate = (key: string) => string;

const RATE_LIMIT_PATTERN = /too many|every \d+ minute|once every|rate limit/i;

export const isReportRateLimited = (message?: string, status?: number): boolean =>
    status === 429 || (!!message && RATE_LIMIT_PATTERN.test(message));

export const getReportErrorMessage = (t: Translate, message?: string, status?: number): string =>
    isReportRateLimited(message, status) ? t('report-rate-limited') : t('report-failed');

export const reportErrorFrom = (error: unknown): { message?: string; status?: number } => ({
    message: error instanceof Error ? error.message : undefined,
    status: (error as { status?: number } | null)?.status,
});
