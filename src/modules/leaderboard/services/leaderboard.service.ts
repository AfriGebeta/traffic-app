import { apiService } from '../../../shared/services/api';
import { LeaderboardEntry, LeaderboardPeriod } from '../types/leaderboard.types';

class LeaderboardService {
    async getLeaderboard(period: LeaderboardPeriod = 'global'): Promise<LeaderboardEntry[]> {
        try {
            const endpoint = period === 'global'
                ? '/api/leaderboard/global'
                : `/api/leaderboard/${period}`;

            const response = await apiService.get<LeaderboardEntry[]>(endpoint);

            if (response.error || !response.data) {
                console.error('Failed to fetch leaderboard:', response.error);
                return [];
            }

            return response.data;
        } catch (error) {
            console.error('Error fetching leaderboard:', error);
            return [];
        }
    }

    async getUserStats(userId: string): Promise<LeaderboardEntry | null> {
        try {
            
            const leaderboard = await this.getLeaderboard('global');
            const userEntry = leaderboard.find(entry => entry.id === userId);
            return userEntry || null;
        } catch (error) {
            console.error('Error fetching user stats:', error);
            return null;
        }
    }
}

export const leaderboardService = new LeaderboardService();
