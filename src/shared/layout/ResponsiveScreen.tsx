import React, { createContext, useContext } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { useLayout } from './useLayout';

export const FORM_MAX_WIDTH = 600;
export const PAGE_MAX_WIDTH = 760;

const ContentWidthContext = createContext<number | null>(null);

export function useContentWidth(): number {
    const { width } = useWindowDimensions();
    const columnWidth = useContext(ContentWidthContext);
    return columnWidth === null ? width : Math.min(width, columnWidth);
}

interface ResponsiveScreenProps {
    children: React.ReactElement;
    fullBleed?: boolean;
    maxWidth?: number;
}

export function ResponsiveScreen({ children, fullBleed = false, maxWidth = PAGE_MAX_WIDTH }: ResponsiveScreenProps) {
    const { isCompact } = useLayout();
    const { colors: theme } = useTheme();

    if (isCompact || fullBleed) return children;

    return (
        <View style={{ flex: 1, backgroundColor: theme.background }}>
            <View style={{ flex: 1, width: '100%', maxWidth, alignSelf: 'center' }}>
                <ContentWidthContext.Provider value={maxWidth}>{children}</ContentWidthContext.Provider>
            </View>
        </View>

    );
}

interface ScreenLayoutOptions {
    fullBleed: string[];
    forms?: string[];
}

export function createScreenLayout({ fullBleed, forms = [] }: ScreenLayoutOptions) {
    return function ScreenLayout({ children, route }: { children: React.ReactElement; route: { name: string } }) {
        return (
            <ResponsiveScreen
                fullBleed={fullBleed.includes(route.name)}
                maxWidth={forms.includes(route.name) ? FORM_MAX_WIDTH : PAGE_MAX_WIDTH}
            >
                {children}
            </ResponsiveScreen>
        );
    };
}
