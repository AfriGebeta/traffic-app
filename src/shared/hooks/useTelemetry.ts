import { useEffect, useState } from 'react';
import telemetryService, { TelemetryData } from '../services/telemetry.service';

export function useTelemetry() {
    const [telemetryData, setTelemetryData] = useState<TelemetryData | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadTelemetry = async () => {
            try {
                const data = await telemetryService.collectTelemetryData();
                setTelemetryData(data);
            } catch (error) {
                console.error('Failed to collect telemetry:', error);
            } finally {
                setIsLoading(false);
            }
        };

        loadTelemetry();
    }, []);

    return {
        telemetryData,
        isLoading,
        refreshTelemetry: async () => {
            setIsLoading(true);
            const data = await telemetryService.collectTelemetryData();
            setTelemetryData(data);
            setIsLoading(false);
        },
    };
}
