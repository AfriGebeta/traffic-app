import React, { createContext, useContext } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useCopilot } from 'react-native-copilot';
import { useTranslation } from 'react-i18next';
import { colors } from '../../../shared/theme/colors';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { endCampaignTour, useCampaignTour } from './campaignTour';

export interface TourActions {
    titleFor?: (stepName: string) => string | undefined;
    // label when the step isn't the last one is always "Next"
    lastLabel: string;
    onLast: () => void;
    onSkipLast?: () => void;
}

export const TourActionsContext = createContext<TourActions | null>(null);

export const TourStepNumber = () => null;

export function TourTooltip() {
    const { t } = useTranslation();
    const { colors: theme } = useTheme();
    const { currentStep, isLastStep, goToNext, stop } = useCopilot();
    const actions = useContext(TourActionsContext);
    const { returning } = useCampaignTour();

    const title = currentStep ? actions?.titleFor?.(currentStep.name) : undefined;

    // Skip passes over this one step, not the whole tour
    const skip = () => {
        if (!isLastStep) {
            void goToNext();
            return;
        }
        void stop();
        (actions?.onSkipLast ?? actions?.onLast)?.();
    };

    // only for people who've been through the tour before
    const skipTour = () => {
        void stop();
        endCampaignTour();
    };

    const primary = () => {
        if (!isLastStep) {
            void goToNext();
            return;
        }
        void stop();
        actions?.onLast();
    };

    return (
        <View>
            {!!title && (
                <Text className="text-base font-bold mb-1" style={{ color: theme.textPrimary }}>
                    {title}
                </Text>
            )}
            <Text className="text-sm leading-5" style={{ color: theme.textSecondary }}>
                {currentStep?.text}
            </Text>
            <View className="flex-row items-center justify-between mt-4">
                <View className="flex-row items-center" style={{ gap: 20 }}>
                    <TouchableOpacity onPress={skip} hitSlop={8} activeOpacity={0.7}>
                        <Text className="font-semibold" style={{ color: theme.textSecondary }}>
                            {t('tour-skip')}
                        </Text>
                    </TouchableOpacity>
                    {returning && (
                        <TouchableOpacity onPress={skipTour} hitSlop={8} activeOpacity={0.7}>
                            <Text className="font-semibold" style={{ color: theme.textSecondary }}>
                                {t('tour-skip-all')}
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>
                <TouchableOpacity
                    onPress={primary}
                    activeOpacity={0.8}
                    className="rounded-full px-5 py-2.5"
                    style={{ backgroundColor: colors.primary.main }}
                >
                    <Text className="font-bold text-white">{isLastStep && actions ? actions.lastLabel : t('tour-next')}</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}
