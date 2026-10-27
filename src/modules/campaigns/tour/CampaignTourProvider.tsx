import React, { PropsWithChildren } from 'react';
import { CopilotProvider } from 'react-native-copilot';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { TourActions, TourActionsContext, TourStepNumber, TourTooltip } from './TourTooltip';

export function CampaignTourProvider({ actions, children }: PropsWithChildren<{ actions: TourActions }>) {
    const { colors: theme } = useTheme();
    return (
        <TourActionsContext.Provider value={actions}>
            <CopilotProvider
                overlay="svg"
                animated
                tooltipComponent={TourTooltip}
                stepNumberComponent={TourStepNumber}
                tooltipStyle={{ backgroundColor: theme.background, borderRadius: 16, paddingTop: 16, paddingHorizontal: 16, paddingBottom: 16 }}
                arrowColor={theme.background}
                backdropColor="rgba(0, 0, 0, 0.6)"
                margin={20}
                androidStatusBarVisible
            >
                {children}
            </CopilotProvider>
        </TourActionsContext.Provider>
    );
}
