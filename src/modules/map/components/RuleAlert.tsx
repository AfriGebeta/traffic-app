import React from 'react';
import { Image } from 'react-native';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface RuleAlertProps {
    ruleId: string;
    ruleName: string;
    ruleImg: string;
    distance: string;
    hasIncidentAlert?: boolean;
}

export const RuleAlert: React.FC<RuleAlertProps> = ({ ruleImg, hasIncidentAlert = false }) => {
    const insets = useSafeAreaInsets();

    return (
        <Animated.View
            entering={FadeInDown.duration(300)}
            exiting={FadeOutUp.duration(300)}
            style={{
                position: 'absolute',
                top: insets.top + (hasIncidentAlert ? 294 : 200),
                right: 16,
                zIndex: 9999,
                elevation: 9,
            }}
        >
            <Image
                source={{ uri: ruleImg }}
                style={{
                    width: 64,
                    height: 64,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.25,
                    shadowRadius: 3.84,
                }}
                resizeMode="contain"
            />
        </Animated.View>
    );
};
