import React, { PropsWithChildren } from 'react';
import { Animated } from 'react-native';
import { CopilotProvider, type CopilotProps } from 'react-native-copilot';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { TourActions, TourActionsContext, TourStepNumber, TourTooltip } from './TourTooltip';

const HOLE_PADDING = 6;
const HOLE_RADIUS = 18;

const current = (value: Animated.Value) => (value as unknown as { _value: number })._value;

const roundedHole: CopilotProps['svgMaskPath'] = ({ size, position, canvasSize }) => {
    const x = current(position.x) - HOLE_PADDING;
    const y = current(position.y) - HOLE_PADDING;
    const width = current(size.x) + HOLE_PADDING * 2;
    const height = current(size.y) + HOLE_PADDING * 2;
    const r = Math.max(0, Math.min(HOLE_RADIUS, width / 2, height / 2));
    return (
        `M0,0H${canvasSize.x}V${canvasSize.y}H0Z` +
        `M${x + r},${y}H${x + width - r}A${r},${r} 0 0 1 ${x + width},${y + r}` +
        `V${y + height - r}A${r},${r} 0 0 1 ${x + width - r},${y + height}` +
        `H${x + r}A${r},${r} 0 0 1 ${x},${y + height - r}` +
        `V${y + r}A${r},${r} 0 0 1 ${x + r},${y}Z`
    );
};

export function CampaignTourProvider({ actions, children }: PropsWithChildren<{ actions: TourActions }>) {
    const { colors: theme } = useTheme();
    return (
        <TourActionsContext.Provider value={actions}>
            <CopilotProvider
                overlay="svg"
                svgMaskPath={roundedHole}
                animated
                tooltipComponent={TourTooltip}
                stepNumberComponent={TourStepNumber}
                tooltipStyle={{ backgroundColor: theme.background, borderRadius: 16, paddingTop: 16, paddingHorizontal: 16, paddingBottom: 16 }}
                arrowColor={theme.background}
                backdropColor="rgba(0, 0, 0, 0.6)"
                // clears the hole's padding plus a visible gap
                margin={20 + HOLE_PADDING}
                androidStatusBarVisible
            >
                {children}
            </CopilotProvider>
        </TourActionsContext.Provider>
    );
}
