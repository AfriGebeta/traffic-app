export const getRuleTranslationKey = (ruleName: string): string => {
    const normalizedName = ruleName.toLowerCase().replace(/\s+/g, '-');
    return `rule-${normalizedName}`;
};

export const getRuleDescriptionTranslationKey = (ruleName: string): string => {
    const normalizedName = ruleName.toLowerCase().replace(/\s+/g, '-');
    return `rule-${normalizedName}-description`;
};

const NON_PUNISHABLE_RULES = new Set([
    'steep hill',
    'two way',
]);

export const isPunishableRule = (ruleName?: string | null): boolean => {
    if (!ruleName) return true;
    return !NON_PUNISHABLE_RULES.has(ruleName.trim().toLowerCase());
};

export const NO_PUNISHMENT_VALUE = '0';

const RULE_DISPLAY_ORDER = [
    'No U-Turn',
    'Traffic Light',
    'No Left Turn',
    'No Right Turn',
    'One Way',
    'No Overtaking',
    'No Parking',
    'Stop',
    'No Stopping',
    'Two Way',
    '30 Is The Limit',
    '50 Is The Limit',
    'Steep Hill',
];

const RULE_ORDER_INDEX = new Map(
    RULE_DISPLAY_ORDER.map((name, index) => [name.toLowerCase(), index])
);

export const sortRuleTypes = <T extends { name: string }>(ruleTypes: T[]): T[] => {
    const rank = (name: string) =>
        RULE_ORDER_INDEX.get(name.trim().toLowerCase()) ?? RULE_DISPLAY_ORDER.length;

    return [...ruleTypes].sort((a, b) => rank(a.name) - rank(b.name));
};

export const RULE_TRANSLATION_MAP: Record<string, { name: string; description: string }> = {
    'Stop': {
        name: 'rule-stop',
        description: 'rule-stop-description',
    },
    'Give Way': {
        name: 'rule-give-way',
        description: 'rule-give-way-description',
    },
    'No Left Turn': {
        name: 'rule-no-left-turn',
        description: 'rule-no-left-turn-description',
    },
    'No Right Turn': {
        name: 'rule-no-right-turn',
        description: 'rule-no-right-turn-description',
    },
    'No U-Turn': {
        name: 'rule-no-u-turn',
        description: 'rule-no-u-turn-description',
    },
    'No Parking': {
        name: 'rule-no-parking',
        description: 'rule-no-parking-description',
    },
    '30 Is The Limit': {
        name: 'rule-30-is-the-limit',
        description: 'rule-30-is-the-limit-description',
    },
    '50 Is The Limit': {
        name: 'rule-50-is-the-limit',
        description: 'rule-50-is-the-limit-description',
    },
    'No Overtaking': {
        name: 'rule-no-overtaking',
        description: 'rule-no-overtaking-description',
    },
    'No Stopping': {
        name: 'rule-no-stopping',
        description: 'rule-no-stopping-description',
    },
    'One Way': {
        name: 'rule-one-way',
        description: 'rule-one-way-description',
    },
    'Steep Hill': {
        name: 'rule-steep-hill',
        description: 'rule-steep-hill-description',
    },
    'Traffic Light': {
        name: 'rule-traffic-light',
        description: 'rule-traffic-light-description',
    },
    'Two Way': {
        name: 'rule-two-way',
        description: 'rule-two-way-description',
    },
};
