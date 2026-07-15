import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRemoteConfig, type RemoteMapStyle } from '../../../shared/contexts/RemoteConfigContext';

export type MapThemeId = string;

export interface MapTheme {
    id: MapThemeId;
    name: string;
    nameAmharic: string;
    icon: string;
    styleUrl?: string;
    styleJson?: Record<string, unknown>;
}

const STORAGE_KEY = '@map_theme';

const processRemoteStyle = async (url: string, apiKey: string): Promise<Record<string, unknown>> => {
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
                        return `${processedTile}${separator}apiKey=${apiKey}`;
                    });
                }
            });
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

interface MapThemeContextType {
    currentTheme: MapTheme;
    setTheme: (themeId: MapThemeId) => void;
    themes: MapTheme[];
    isLoading: boolean;
}

const MapThemeContext = createContext<MapThemeContextType | undefined>(undefined);

const remoteStyleToTheme = (style: RemoteMapStyle, styleJson: Record<string, unknown>): MapTheme => ({
    id: style.id,
    name: style.name,
    nameAmharic: style.nameAmharic,
    icon: style.icon,
    styleUrl: style.url,
    styleJson,
});

export const MapThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { apiKey, mapStyles } = useRemoteConfig();
    const enabledStyles = mapStyles.filter(s => s.enabled);

    const [currentTheme, setCurrentTheme] = useState<MapTheme>({
        id: enabledStyles[0]?.id ?? 'standard',
        name: enabledStyles[0]?.name ?? 'Classic',
        nameAmharic: enabledStyles[0]?.nameAmharic ?? 'ክላሲክ',
        icon: enabledStyles[0]?.icon ?? 'map-outline',
    });
    const [themes, setThemes] = useState<MapTheme[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (enabledStyles.length === 0) return;

        const loadThemes = async () => {
            try {
                const savedThemeId = await AsyncStorage.getItem(STORAGE_KEY);
                const activeStyle = enabledStyles.find(s => s.id === savedThemeId) ?? enabledStyles[0];

                const activeStyleJson = await processRemoteStyle(activeStyle.url, apiKey);
                const activeTheme = remoteStyleToTheme(activeStyle, activeStyleJson);

                setCurrentTheme(activeTheme);
                setIsLoading(false);

                const otherStyles = enabledStyles.filter(s => s.id !== activeStyle.id);
                const otherStyleJsons = await Promise.all(
                    otherStyles.map(s => processRemoteStyle(s.url, apiKey))
                );

                const loadedThemes: MapTheme[] = enabledStyles.map(s => {
                    if (s.id === activeStyle.id) return activeTheme;
                    const index = otherStyles.findIndex(o => o.id === s.id);
                    return remoteStyleToTheme(s, otherStyleJsons[index]);
                });

                setThemes(loadedThemes);
            } catch (error) {
                console.error('Failed to load themes:', error);
                setIsLoading(false);
            }
        };

        loadThemes();
    }, [apiKey, mapStyles]);

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
