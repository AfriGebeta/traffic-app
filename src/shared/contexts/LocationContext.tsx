import React, { createContext, useContext, useState, ReactNode } from 'react';

interface LocationContextType {
    selectedLocation: { lat: number; lng: number } | null;
    setSelectedLocation: (location: { lat: number; lng: number } | null) => void;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export function LocationProvider({ children }: { children: ReactNode }) {
    const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);

    return (
        <LocationContext.Provider value={{ selectedLocation, setSelectedLocation }}>
            {children}
        </LocationContext.Provider>
    );
}

export function useLocation() {
    const context = useContext(LocationContext);
    if (context === undefined) {
        throw new Error('useLocation must be used within a LocationProvider');
    }
    return context;
}
