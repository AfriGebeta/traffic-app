import React, { createContext, useContext, useState, ReactNode } from 'react';

interface RouteStop {
    id: string;
    name: string;
    lat: number;
    lng: number;
    type: 'station' | 'stop';
    existingNodeId?: number;
    isExisting?: boolean;
}

interface RouteBuilderContextType {
    pendingStop: RouteStop | null;
    setPendingStop: (stop: RouteStop | null) => void;
    pickType: 'start' | 'end' | 'intermediate' | null;
    setPickType: (type: 'start' | 'end' | 'intermediate' | null) => void;
}

const RouteBuilderContext = createContext<RouteBuilderContextType | undefined>(undefined);

export function RouteBuilderProvider({ children }: { children: ReactNode }) {
    const [pendingStop, setPendingStop] = useState<RouteStop | null>(null);
    const [pickType, setPickType] = useState<'start' | 'end' | 'intermediate' | null>(null);

    return (
        <RouteBuilderContext.Provider value={{ pendingStop, setPendingStop, pickType, setPickType }}>
            {children}
        </RouteBuilderContext.Provider>
    );
}

export function useRouteBuilder() {
    const context = useContext(RouteBuilderContext);
    if (context === undefined) {
        throw new Error('useRouteBuilder must be used within a RouteBuilderProvider');
    }
    return context;
}
