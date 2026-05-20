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

        const layers = Array.isArray(style.layers) ? style.layers : [];
        if (!layers.some((layer: { type?: string }) => layer.type === 'background')) {
            style.layers = [
                {
                    id: 'gebeta-map-background',
                    type: 'background',
                    paint: { 'background-color': '#E5E7EB' },
                },
                ...layers,
            ];
        }

        return style as Record<string, unknown>;
    } catch (error) {
        console.error('Failed to fetch and process style:', error);
        return {};
    }
};

const STYLE_URLS: Record<MapThemeId, string> = {
    standard: 'https://tiles.gebeta.app/styles/standard/style.json',
    custom3: 'https://tiles.gebeta.app/styles/standard/light.json',
    dark: 'https://tiles.gebeta.app/styles/standard/dark.json',
    raster: 'https://tiles.gebeta.app/styles/raster/raster.json',
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
        styleUrl: 'https://tiles.gebeta.app/styles/raster/raster.json',
    },
];

interface MapThemeContextType {
    currentTheme: MapTheme;
    setTheme: (themeId: MapThemeId) => void;
    themes: MapTheme[];
    isLoading: boolean;
}

const MapThemeContext = createContext<MapThemeContextType | undefined>(undefined);

const themeWithStyle = (base: (typeof BASE_THEMES)[number], styleJson: Record<string, unknown>): MapTheme => ({
    ...(base as MapTheme),
    styleJson,
});

export const MapThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [currentTheme, setCurrentTheme] = useState<MapTheme>({
        ...BASE_THEMES[0],
        styleUrl: undefined,
        styleJson: undefined,
    } as MapTheme);
    const [themes, setThemes] = useState<MapTheme[]>(BASE_THEMES as MapTheme[]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadThemes = async () => {
            try {
                const savedThemeId = (await AsyncStorage.getItem(STORAGE_KEY)) as MapThemeId | null;
                const activeThemeId: MapThemeId =
                    savedThemeId && savedThemeId in STYLE_URLS ? savedThemeId : 'standard';

                const activeStyle = await processRemoteStyle(STYLE_URLS[activeThemeId]);
                const activeBase = BASE_THEMES.find((t) => t.id === activeThemeId) ?? BASE_THEMES[0];
                const activeTheme = themeWithStyle(activeBase, activeStyle);

                setCurrentTheme(activeTheme);
                setIsLoading(false);

                const otherIds = (Object.keys(STYLE_URLS) as MapThemeId[]).filter(
                    (id) => id !== activeThemeId
                );
                const otherStyles = await Promise.all(
                    otherIds.map((id) => processRemoteStyle(STYLE_URLS[id]))
                );

                const loadedThemes: MapTheme[] = BASE_THEMES.map((base) => {
                    if (base.id === activeThemeId) {
                        return activeTheme;
                    }
                    const index = otherIds.indexOf(base.id as MapThemeId);
                    return themeWithStyle(base, otherStyles[index]);
                });

                setThemes(loadedThemes);
            } catch (error) {
                console.error('Failed to load themes:', error);
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
