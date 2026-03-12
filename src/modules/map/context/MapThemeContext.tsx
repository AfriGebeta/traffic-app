import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

const processRemoteStyle = async (url: string): Promise<Record<string, unknown>> => {
    try {
        const response = await fetch(url);
        const style = await response.json();

        if (style.sources) {
            Object.keys(style.sources).forEach(sourceKey => {
                const source = style.sources[sourceKey];
                if (source.tiles && Array.isArray(source.tiles)) {
                    source.tiles = source.tiles.map((tile: string) => {
                        const processedTile = tile.replace('~~TILE_ENDPOINT~~', 'https://tiles.gebeta.app/tiles');
                        const separator = processedTile.includes('?') ? '&' : '?';
                        return `${processedTile}${separator}apiKey=${process.env.EXPO_PUBLIC_GEBETA_API_KEY}`;
                    });
                }
            });
        }

        if (style.layers && Array.isArray(style.layers)) {
            style.layers.forEach((layer: any) => {
                if (layer.layout && layer.layout['text-font']) {
                    layer.layout['text-font'] = ['Noto Serif Ethiopic'];
                }
            });
        }

        if (style.glyphs) {
            style.glyphs = 'https://tiles.gebeta.app/fonts/{fontstack}/{range}.pbf';
        }

        return style as Record<string, unknown>;
    } catch (error) {
        console.error('Failed to fetch and process style:', error);
        return {};
    }
};

const BASE_THEMES: (Omit<MapTheme, 'styleJson'> & { styleJson?: Record<string, unknown> })[] = [
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
    },
    {
        id: 'dark',
        name: 'Dark',
        nameAmharic: 'ጨለማ',
        icon: 'moon-outline',
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
    const [currentTheme, setCurrentTheme] = useState<MapTheme>(BASE_THEMES[0] as MapTheme);
    const [themes, setThemes] = useState<MapTheme[]>(BASE_THEMES as MapTheme[]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadThemes = async () => {
            try {
                const [lightStyle, darkStyle] = await Promise.all([
                    processRemoteStyle('https://tiles.gebeta.app/styles/standard/light.json'),
                    processRemoteStyle('https://tiles.gebeta.app/styles/standard/dark.json'),
                ]);

                const loadedThemes: MapTheme[] = [
                    BASE_THEMES[0],
                    { ...BASE_THEMES[1], styleJson: lightStyle },
                    { ...BASE_THEMES[2], styleJson: darkStyle },
                    BASE_THEMES[3],
                ];

                setThemes(loadedThemes);

                //load saved 
                const savedThemeId = await AsyncStorage.getItem(STORAGE_KEY);
                if (savedThemeId) {
                    const theme = loadedThemes.find(t => t.id === savedThemeId);
                    if (theme) {
                        setCurrentTheme(theme);
                    }
                } else {
                    setCurrentTheme(loadedThemes[0]);
                }
            } catch (error) {
                console.error('Failed to load themes:', error);
            } finally {
                setIsLoading(false);
            }
        };

        loadThemes();
    }, []);

    const setTheme = useCallback(async (themeId: MapThemeId) => {
        const theme = themes.find(t => t.id === themeId);
        if (theme) {
            setCurrentTheme(theme);
            try {
                await AsyncStorage.setItem(STORAGE_KEY, themeId);
            } catch (error) {
                console.error('Failed to save theme:', error);
            }
        }
    }, [themes]);

    return (
        <MapThemeContext.Provider value={{
            currentTheme,
            setTheme,
            themes,
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
