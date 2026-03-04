export const getRuleTranslationKey = (ruleName: string): string => {
    const normalizedName = ruleName.toLowerCase().replace(/\s+/g, '-');
    return `rule-${normalizedName}`;
};

export const getRuleDescriptionTranslationKey = (ruleName: string): string => {
    const normalizedName = ruleName.toLowerCase().replace(/\s+/g, '-');
    return `rule-${normalizedName}-description`;
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
};
