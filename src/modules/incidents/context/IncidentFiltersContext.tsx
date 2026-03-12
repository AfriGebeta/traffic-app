import React, { createContext, useContext, ReactNode } from 'react';
import { useIncidentFilters } from '../hooks/useIncidentFilters';

interface IncidentFiltersContextType {
    filters: { enabledTypes: string[] };
    loading: boolean;
    toggleType: (typeName: string) => Promise<void>;
    isTypeEnabled: (typeName: string) => boolean;
    onFiltersChanged?: () => void;
}

const IncidentFiltersContext = createContext<IncidentFiltersContextType | undefined>(undefined);

export const IncidentFiltersProvider = ({ children }: { children: ReactNode }) => {
    const filterHook = useIncidentFilters();
    const [onFiltersChanged, setOnFiltersChanged] = React.useState<(() => void) | undefined>();

    const toggleTypeWithCallback = async (typeName: string) => {
        await filterHook.toggleType(typeName);
        if (onFiltersChanged) {
            onFiltersChanged();
        }
    };

    const contextValue = {
        ...filterHook,
        toggleType: toggleTypeWithCallback,
        onFiltersChanged,
    };

    return (
        <IncidentFiltersContext.Provider value={contextValue}>
            {children}
        </IncidentFiltersContext.Provider>
    );
};

export const useIncidentFiltersContext = () => {
    const context = useContext(IncidentFiltersContext);
    if (!context) {
        throw new Error('useIncidentFiltersContext must be used within IncidentFiltersProvider');
    }
    return context;
};

export const useRegisterFiltersCallback = (callback: () => void) => {
    const context = useIncidentFiltersContext();

    React.useEffect(() => {
        (context as any).onFiltersChanged = callback;
        return () => {
            (context as any).onFiltersChanged = undefined;
        };
    }, [callback, context]);
};
