export interface LeaderboardEntry {
    id: string;
    name: string;
    points: number;
    level: string;
    rank: number;
    reportsCount: number;
}

export type LeaderboardPeriod = 'global' | 'weekly' | 'monthly';
