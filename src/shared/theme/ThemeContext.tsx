import React, { createContext, useContext, useMemo, ReactNode } from 'react';
import { lightTheme, darkTheme, type ThemeColors } from './colors';
import { useMapTheme } from '../../modules/map/context/MapThemeContext';

interface ThemeContextType {
    colors: ThemeColors;
    isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// App UI follows the map style: dark UI only when the 'Dark' map tile style is active.
export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { currentTheme } = useMapTheme();
    const isDark = currentTheme.id === 'dark';

    const value = useMemo(() => ({
        colors: isDark ? darkTheme : lightTheme,
        isDark,
    }), [isDark]);

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = (): ThemeContextType => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};
