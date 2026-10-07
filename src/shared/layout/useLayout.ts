import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getAppConfig } from '../config/remoteConfigValues';

export type LayoutTier = 'compact' | 'medium' | 'wide';

const TABLET_MIN_SHORTEST_SIDE = 600;
const WIDE_MIN_WIDTH = 900;
const WIDE_MIN_HEIGHT = 480;

export const RAIL_WIDTH = 76;
export const PANEL_WIDTH = 400;
export const LAYOUT_GUTTER = 12;
export const MEDIUM_MAX_WIDTH = 600;

const FORCED_TIER = process.env.EXPO_PUBLIC_FORCE_LAYOUT;

export function isResponsiveLayoutEnabled(): boolean {
    return getAppConfig().responsiveLayoutEnabled === 1;
}

export function isTabletSized(width: number, height: number): boolean {
    return Math.min(width, height) >= TABLET_MIN_SHORTEST_SIDE;
}

export function isLandscapeDisplay(width: number, height: number): boolean {
    return width > height && height >= WIDE_MIN_HEIGHT;
}

export function getLayoutTier(width: number, height: number): LayoutTier {
    if (__DEV__ && (FORCED_TIER === 'compact' || FORCED_TIER === 'medium' || FORCED_TIER === 'wide')) {
        return FORCED_TIER;
    }
    if (!isResponsiveLayoutEnabled()) return 'compact';
    if (width >= WIDE_MIN_WIDTH && height >= WIDE_MIN_HEIGHT) return 'wide';
    return isTabletSized(width, height) ? 'medium' : 'compact';
}

export function useLayout() {
    const { width, height } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const tier = getLayoutTier(width, height);

    const centeredInset = (maxWidth: number = MEDIUM_MAX_WIDTH) => Math.max(16, (width - maxWidth) / 2);

    const panelLeft = (withRail = true) =>
        insets.left + LAYOUT_GUTTER + (withRail ? RAIL_WIDTH + LAYOUT_GUTTER : 0);

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
