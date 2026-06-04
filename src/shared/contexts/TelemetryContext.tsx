import React, { createContext, useContext, ReactNode } from 'react';
import telemetryApiService from '../services/telemetry-api.service';

interface TelemetryContextValue {
    trackEvent: (eventName: string, eventData?: Record<string, any>) => Promise<boolean>;
    trackNavigation: (from: string, to: string) => Promise<void>;
    trackFeatureUsage: (featureName: string, metadata?: Record<string, any>) => Promise<void>;
    trackError: (error: Error, context?: Record<string, any>) => Promise<void>;
}

const TelemetryContext = createContext<TelemetryContextValue | undefined>(undefined);

interface TelemetryProviderProps {
    children: ReactNode;
}

export function TelemetryProvider({ children }: TelemetryProviderProps) {
    const value: TelemetryContextValue = {
        trackEvent: telemetryApiService.sendTelemetry.bind(telemetryApiService),
        trackNavigation: telemetryApiService.trackNavigation.bind(telemetryApiService),
        trackFeatureUsage: telemetryApiService.trackFeatureUsage.bind(telemetryApiService),
        trackError: telemetryApiService.trackError.bind(telemetryApiService),
    };

    return (
        <TelemetryContext.Provider value={value}>
            {children}
        </TelemetryContext.Provider>
    );
}

export function useTelemetryTracking() {
    const context = useContext(TelemetryContext);

    if (!context) {
        throw new Error('useTelemetryTracking must be used within TelemetryProvider');
    }

    return context;
}
