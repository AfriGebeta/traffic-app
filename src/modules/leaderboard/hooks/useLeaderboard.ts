import { useState, useEffect } from 'react';
import { leaderboardService } from '../services/leaderboard.service';
import { LeaderboardEntry, LeaderboardPeriod } from '../types/leaderboard.types';

export const useLeaderboard = (period: LeaderboardPeriod = 'global') => {
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchLeaderboard();
    }, [period]);

    const fetchLeaderboard = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await leaderboardService.getLeaderboard(period);
            setLeaderboard(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch leaderboard');
        } finally {
            setLoading(false);
        }
    };

    return { leaderboard, loading, error, refetch: fetchLeaderboard };
};
