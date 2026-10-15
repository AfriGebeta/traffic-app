type Translate = (key: string) => string;

const KNOWN_KINDS = ['weekly', 'monthly', 'total'];

// prefer the backend's own label ("Grand total", "Week 41"), then our translation for known kinds
export const periodLabel = (
    period: string | { kind?: string; label?: string } | undefined,
    t: Translate
): string => {
    if (!period) return '';
    const kind = typeof period === 'string' ? period : period.kind;
    const label = typeof period === 'string' ? undefined : period.label;
    if (label) return label;
    return kind && KNOWN_KINDS.includes(kind) ? t(`campaign-period-${kind}`) : kind ?? '';
};
