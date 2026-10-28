import { CampaignKind } from '../types/campaign.types';

type Translate = (key: string, options?: Record<string, unknown>) => string;

const KIND_PLURAL_KEYS: Partial<Record<CampaignKind, string>> = {
    place: 'tour-kind-place',
    traffic_rule: 'tour-kind-traffic-rule',
    taxi_station: 'tour-kind-taxi-station',
};

export const kindList = (kinds: CampaignKind[], t: Translate): string => {
    const names = kinds.map((kind) => KIND_PLURAL_KEYS[kind]).filter((key): key is string => !!key).map((key) => t(key));
    if (names.length <= 1) return names[0] ?? '';
    return `${names.slice(0, -1).join(t('tour-list-separator'))} ${t('tour-list-and')} ${names[names.length - 1]}`;
};

export const sentences = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');
