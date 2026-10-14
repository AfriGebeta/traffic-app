export const toReportHeading = (heading?: number | string | null): number | undefined => {
    const value = typeof heading === 'string' ? parseFloat(heading) : heading;
    if (value == null || !Number.isFinite(value) || value < 0) return undefined;
    return Math.round(value % 360);
};

export type ReportLocation = { lat: number; lng: number; heading?: number };
