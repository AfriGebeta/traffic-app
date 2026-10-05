import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getAppConfig } from '../config/remoteConfigValues';

// compact = phones (untouched layouts), medium = portrait tablets (phone layout, capped widths),
// wide = landscape tablets / car screens (rail + left panel over a full-screen map)
export type LayoutTier = 'compact' | 'medium' | 'wide';

const TABLET_MIN_SHORTEST_SIDE = 600;
const WIDE_MIN_WIDTH = 900;

export const RAIL_WIDTH = 76;
export const PANEL_WIDTH = 400;
export const LAYOUT_GUTTER = 12;
// cap for phone-style bars/sheets on medium screens
export const MEDIUM_MAX_WIDTH = 600;

const FORCED_TIER = process.env.EXPO_PUBLIC_FORCE_LAYOUT;

export function isResponsiveLayoutEnabled(): boolean {
    // remote kill switch: responsive_layout_enabled = 2 turns big-screen layouts off everywhere
    return getAppConfig().responsiveLayoutEnabled === 1;
}

export function isTabletSized(width: number, height: number): boolean {
    return Math.min(width, height) >= TABLET_MIN_SHORTEST_SIDE;
}

export function getLayoutTier(width: number, height: number): LayoutTier {
    if (__DEV__ && (FORCED_TIER === 'compact' || FORCED_TIER === 'medium' || FORCED_TIER === 'wide')) {
        return FORCED_TIER;
    }
    if (!isResponsiveLayoutEnabled() || !isTabletSized(width, height)) return 'compact';
    return width >= WIDE_MIN_WIDTH ? 'wide' : 'medium';
}

export function useLayout() {
    const { width, height } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const tier = getLayoutTier(width, height);

    // horizontal inset that centers a block of at most maxWidth (phone gutter of 16 as the floor)
    const centeredInset = (maxWidth: number = MEDIUM_MAX_WIDTH) => Math.max(16, (width - maxWidth) / 2);

    // wide: x where the left panel starts (right of the rail when the rail is shown)
    const panelLeft = (withRail = true) =>
        insets.left + LAYOUT_GUTTER + (withRail ? RAIL_WIDTH + LAYOUT_GUTTER : 0);

    return {
        tier,
        isCompact: tier === 'compact',
        isMedium: tier === 'medium',
        isWide: tier === 'wide',
        width,
        height,
        centeredInset,
        panelLeft,
    };
}
