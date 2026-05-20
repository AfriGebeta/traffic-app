import { apiService } from '../../../shared/services/api';

interface SearchLogEntry {
    searchedPlace: string;
    userSelectedPlace: {
        name: string;
        coords: [number, number];
    };
}

class SearchLogService {
    private pendingLogs: SearchLogEntry[] = [];
    private flushTimeout: ReturnType<typeof setTimeout> | null = null;
    private currentSearchQuery: string = '';

    setSearchQuery(query: string) {
        this.currentSearchQuery = query.trim();
        console.log('current search query set to:', this.currentSearchQuery);
    }

    trackSearch(searchedPlace: string, selectedPlace: { name: string; latitude: number; longitude: number }) {
        const logEntry: SearchLogEntry = {
            searchedPlace,
            userSelectedPlace: {
                name: selectedPlace.name,
                coords: [selectedPlace.latitude, selectedPlace.longitude],
            },
        };


        this.pendingLogs.push(logEntry);

        if (this.flushTimeout) {
            clearTimeout(this.flushTimeout);
        }

        this.flushTimeout = setTimeout(() => {
            this.flushLogs();
        }, 3000);
    }

    getAndClearSearchQuery(): string {
        const query = this.currentSearchQuery;
        this.currentSearchQuery = '';
        return query;
    }

    private async flushLogs() {
        if (this.pendingLogs.length === 0) {
            return;
        }

        const logsToSend = [...this.pendingLogs];
        this.pendingLogs = [];

        console.log('flushing logs to server:', logsToSend);

        try {
            const response = await apiService.post('/api/navigation/collect-search-logs', logsToSend);

            if (response.error) {
                console.error('failed to send logs(search):', response.error);
                this.pendingLogs.unshift(...logsToSend);
            } else {
                console.log('successfully sent logs:', response.data);
            }
        } catch (error) {
            console.error('failed to send logs:', error);
            this.pendingLogs.unshift(...logsToSend);
        }
    }

    async flush() {
        if (this.flushTimeout) {
            clearTimeout(this.flushTimeout);
            this.flushTimeout = null;
        }
        await this.flushLogs();
    }
}

export const searchLogService = new SearchLogService();
