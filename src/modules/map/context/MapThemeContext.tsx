import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import customMapTheme from '../../../../assets/map-styles/custom-map-theme.json';

export type MapThemeId = 'standard' | 'basic';

export interface MapTheme {
    id: MapThemeId;
    name: string;
    nameAmharic: string;
    icon: string;
    styleUrl?: string;
    styleJson?: Record<string, unknown>;
}

const STORAGE_KEY = '@map_theme';

export const MAP_THEMES: MapTheme[] = [
    {
        id: 'standard',
        name: 'Standard',
        nameAmharic: 'መደበኛ',
        icon: 'map-outline',
        styleUrl: `https://tiles.gebeta.app/styles/standard/style.json`,
    },
    {
        id: 'basic',
        name: 'Basic',
        nameAmharic: 'መሠረታዊ',
        icon: 'layers-outline',
        styleJson: (() => {
            const theme = JSON.parse(JSON.stringify(customMapTheme));
            if (theme.sources) {
                Object.keys(theme.sources).forEach(sourceKey => {
                    const source = theme.sources[sourceKey];
                    if (source.tiles && Array.isArray(source.tiles)) {
                        source.tiles = source.tiles.map((tile: string) => {
                            const processedTile = tile.replace('~~TILE_ENDPOINT~~', 'https://tiles.gebeta.app/tiles');
                            const separator = processedTile.includes('?') ? '&' : '?';
                            return `${processedTile}${separator}apiKey=${process.env.EXPO_PUBLIC_GEBETA_API_KEY}`;
                        });
                    }
                });
            }
            console.log('Basic theme processed:', theme.sources);
            return theme as Record<string, unknown>;
        })(),
    },
];

interface MapThemeContextType {
    currentTheme: MapTheme;
    setTheme: (themeId: MapThemeId) => void;
    themes: MapTheme[];
    isLoading: boolean;
}

const MapThemeContext = createContext<MapThemeContextType | undefined>(undefined);

export const MapThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [currentTheme, setCurrentTheme] = useState<MapTheme>(MAP_THEMES[0]);
    const [isLoading, setIsLoading] = useState(true);

    React.useEffect(() => {
        const loadSavedTheme = async () => {
            try {
                const savedThemeId = await AsyncStorage.getItem(STORAGE_KEY);
                if (savedThemeId) {
                    const theme = MAP_THEMES.find(t => t.id === savedThemeId);
                    if (theme) {
                        setCurrentTheme(theme);
                    }
                }
            } catch (error) {
                console.error('Failed to load saved theme:', error);
            } finally {
                setIsLoading(false);
            }
        };
        loadSavedTheme();
    }, []);

    const setTheme = useCallback(async (themeId: MapThemeId) => {
        const theme = MAP_THEMES.find(t => t.id === themeId);
        if (theme) {
            setCurrentTheme(theme);
            try {
                await AsyncStorage.setItem(STORAGE_KEY, themeId);
            } catch (error) {
                console.error('Failed to save theme:', error);
            }
        }
    }, []);

    return (
        <MapThemeContext.Provider value={{
            currentTheme,
            setTheme,
            themes: MAP_THEMES,
            isLoading,
        }}>
            {children}
        </MapThemeContext.Provider>
    );
};

export const useMapTheme = (): MapThemeContextType => {
    const context = useContext(MapThemeContext);
    if (!context) {
        throw new Error('useMapTheme must be used within a MapThemeProvider');
    }
    return context;
};
