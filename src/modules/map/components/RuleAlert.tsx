import React from 'react';
import { Image, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface RuleAlertProps {
    ruleId: string;
    ruleName: string;
    ruleImg: string;
    distance: string;
    punishment: string;
    hasIncidentAlert?: boolean;
}

export const RuleAlert: React.FC<RuleAlertProps> = ({ ruleImg, punishment, hasIncidentAlert = false }) => {
    const insets = useSafeAreaInsets();

    return (
        <Animated.View
            entering={FadeInDown.duration(300)}
            exiting={FadeOutUp.duration(300)}
            style={{
                position: 'absolute',
                top: insets.top + (hasIncidentAlert ? 265 : 200),
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
            <View
                style={{
                    marginTop: 4,
                    backgroundColor: 'rgba(0, 0, 0, 0.75)',
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    borderRadius: 4,
                }}
            >
                <Text
                    style={{
                        color: '#FFFFFF',
                        fontSize: 12,
                        fontWeight: '600',
                        textAlign: 'center',
                    }}
                    numberOfLines={2}
                >
                    {punishment}
                </Text>
            </View>
        </Animated.View>
    );
};
