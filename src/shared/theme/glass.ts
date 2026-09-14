import { Platform, ViewStyle } from 'react-native';
import { useMemo } from 'react';
import { useTheme } from './ThemeContext';

export type GlassStrength = 'thin' | 'regular' | 'thick';

const FILL_ALPHA: Record<GlassStrength, { dark: number; light: number }> = {
    thin: { dark: 0.20, light: 0.40 },
    regular: { dark: 0.26, light: 0.50 },
    thick: { dark: 0.30, light: 0.58 },
};

export const glassFill = (isDark: boolean, strength: GlassStrength = 'regular'): string => {
    const alpha = FILL_ALPHA[strength][isDark ? 'dark' : 'light'];
    return `rgba(${isDark ? '125, 145, 156' : '255, 255, 255'}, ${Platform.OS === 'ios' ? alpha * 0.45 : alpha})`;
};

const rimColor = (isDark: boolean) =>
    isDark ? 'rgba(235,246,255,0.24)' : 'rgba(255,255,255,0.74)';
export const glassSurface = (isDark: boolean, strength: GlassStrength = 'regular'): ViewStyle => ({
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'transparent',
    boxShadow: [{
        offsetX: 0,
        offsetY: strength === 'thin' ? 2 : 4,
        blurRadius: strength === 'thin' ? 6 : 12,
        color: isDark ? 'rgba(0,0,0,0.20)' : 'rgba(55,65,70,0.10)',
    }],
});

export const glassSheen = (isDark: boolean) => ({
    top: isDark ? 0.20 : 0.36,
    bottom: isDark ? 0.07 : 0.025,
    streak: isDark ? 0.045 : 0.10,
    edge: isDark ? 0.48 : 0.95,
});

export const useGlass = () => {
    const { isDark } = useTheme();
    return useMemo(() => ({
        isDark,
        rim: rimColor(isDark),
        thin: glassSurface(isDark, 'thin'),
        surface: glassSurface(isDark),
        panel: glassSurface(isDark, 'thick'),
        chip: glassSurface(isDark, 'thin'),
        sheen: glassSheen(isDark),
        fill: (strength: GlassStrength = 'regular') => glassFill(isDark, strength),
    }), [isDark]);
};
