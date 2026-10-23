export const ordinal = (rank: number, language: string): string => {
    if (language.startsWith('am')) return `${rank}ኛ`;
    const lastTwo = rank % 100;
    if (lastTwo >= 11 && lastTwo <= 13) return `${rank}th`;
    return `${rank}${['th', 'st', 'nd', 'rd'][rank % 10] ?? 'th'}`;
};
