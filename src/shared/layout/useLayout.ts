import { Dimensions, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getAppConfig } from '../config/remoteConfigValues';
import { useKeyboardHeight } from './keyboardHeight';

export type LayoutTier = 'compact' | 'medium' | 'wide';

const TABLET_MIN_SHORTEST_SIDE = 600;
const WIDE_MIN_LONG_SIDE = 840;
const WIDE_MIN_SHORT_SIDE = 500;
const WIDE_MIN_WINDOW_HEIGHT = 420;

export const RAIL_WIDTH = 76;
export const PANEL_WIDTH = 400;
export const LAYOUT_GUTTER = 12;
export const RAIL_EDGE_INSET = 8;
export const MEDIUM_MAX_WIDTH = 600;

const FORCED_TIER = process.env.EXPO_PUBLIC_FORCE_LAYOUT;

export function isResponsiveLayoutEnabled(): boolean {
    return getAppConfig().responsiveLayoutEnabled === 1;
}

export function canDisplayHostWide(screenWidth: number, screenHeight: number): boolean {
    const long = Math.round(Math.max(screenWidth, screenHeight));
    const short = Math.round(Math.min(screenWidth, screenHeight));
    return long >= WIDE_MIN_LONG_SIDE && short >= WIDE_MIN_SHORT_SIDE;
}

export function isTabletSized(width: number, height: number): boolean {
    return Math.round(Math.min(width, height)) >= TABLET_MIN_SHORTEST_SIDE;
}

export function isBigDisplay(screenWidth: number, screenHeight: number): boolean {
    return isTabletSized(screenWidth, screenHeight) || canDisplayHostWide(screenWidth, screenHeight);
}

export function getLayoutTier(width: number, height: number): LayoutTier {
    if (__DEV__ && (FORCED_TIER === 'compact' || FORCED_TIER === 'medium' || FORCED_TIER === 'wide')) {
        return FORCED_TIER;
    }
    if (!isResponsiveLayoutEnabled()) return 'compact';
    const screen = Dimensions.get('screen');
    if (
        canDisplayHostWide(screen.width, screen.height) &&
        Math.round(width) >= WIDE_MIN_LONG_SIDE &&
        Math.round(height) >= WIDE_MIN_WINDOW_HEIGHT
    ) {
        return 'wide';
    }
    return isTabletSized(width, height) ? 'medium' : 'compact';
}

let lastLoggedLayout = '';

export function useLayout() {
    const { width, height } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const keyboardHeight = useKeyboardHeight();
    const screenHeight = Dimensions.get('screen').height;
    const layoutHeight = keyboardHeight > 0 ? Math.min(height + keyboardHeight, screenHeight) : height;
    const tier = getLayoutTier(width, layoutHeight);

    if (__DEV__) {
        const key = `${tier} window=${Math.round(width)}x${Math.round(layoutHeight)}`;
        if (key !== lastLoggedLayout) {
            lastLoggedLayout = key;
            console.log(`layout: ${key} enabled=${isResponsiveLayoutEnabled()}`);
        }
    }

    const centeredInset = (maxWidth: number = MEDIUM_MAX_WIDTH) => Math.max(16, (width - maxWidth) / 2);

    const panelLeft = (withRail = true) =>
        insets.left + (withRail ? RAIL_EDGE_INSET + RAIL_WIDTH + LAYOUT_GUTTER : LAYOUT_GUTTER);

    const panelPlacement = ({ withRail = false, mediumMaxWidth = MEDIUM_MAX_WIDTH } = {}) =>
        tier === 'wide'
            ? { left: panelLeft(withRail), right: 'auto' as const, width: PANEL_WIDTH }
            : tier === 'medium'
                ? { left: centeredInset(mediumMaxWidth), right: centeredInset(mediumMaxWidth) }
                : null;

    return {
        tier,
        isCompact: tier === 'compact',
        isMedium: tier === 'medium',
        isWide: tier === 'wide',
        width,
        height,
        centeredInset,
        panelLeft,
        panelPlacement,
    };
}
