import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import customMapTheme3 from '../../../../assets/map-styles/custom-map-theme (9).json';
import DarkTheme from '../../../../assets/map-styles/Untitled-1.json';

export type MapThemeId = 'standard' | 'custom3' | 'dark' | 'raster';

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
        name: 'Classic',
        nameAmharic: 'ክላሲክ',
        icon: 'map-outline',
        styleUrl: `https://tiles.gebeta.app/styles/standard/style.json`,
    },
    {
        id: 'custom3',
        name: 'Standard',
        nameAmharic: 'መደበኛ',
        icon: 'color-palette-outline',
        styleJson: (() => {
            const theme = JSON.parse(JSON.stringify(customMapTheme3));
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
            return theme as Record<string, unknown>;
        })(),
    },
    {
        id: 'dark',
        name: 'Dark',
        nameAmharic: 'ጨለማ',
        icon: 'moon-outline',
        styleJson: (() => {
            const theme = JSON.parse(JSON.stringify(DarkTheme));
   
            theme.glyphs = 'https://tiles.gebeta.app/fonts/{fontstack}/{range}.pbf';

            if (theme.layers && Array.isArray(theme.layers)) {
                theme.layers.forEach((layer: any) => {
                    if (layer.layout && layer.layout['text-font']) {
                        layer.layout['text-font'] = ['Noto Serif Ethiopic'];
                    }
                });
            }

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
            return theme as Record<string, unknown>;
        })(),
    },
    {
        id: 'raster',
        name: 'Satellite',
        nameAmharic: 'ሳተላይት',
        icon: 'globe-outline',
        styleJson: {
            version: 8,
            name: 'Satellite',
            sources: {
                'satellite': {
                    type: 'raster',
                    tiles: [`https://tiles.gebeta.app/tiles/raster/{z}/{x}/{y}.png?apiKey=${process.env.EXPO_PUBLIC_GEBETA_API_KEY}`],
                    tileSize: 256,
                    minzoom: 0,
                    maxzoom: 16,
                },
            },
            layers: [
                {
                    id: 'satellite-layer',
                    type: 'raster',
                    source: 'satellite',
                },
            ],
        } as Record<string, unknown>,
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
