import React, { useRef } from 'react';
import { View, Animated, PanResponder, Dimensions } from 'react-native';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const MIN_HEIGHT = 200;
const MAX_HEIGHT = SCREEN_HEIGHT; // Full screen

interface BottomSheetProps {
    children: React.ReactNode;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({ children }) => {
    const translateY = useRef(new Animated.Value(SCREEN_HEIGHT - MIN_HEIGHT)).current;

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => false,
            onMoveShouldSetPanResponder: (_, gestureState) => {
                return Math.abs(gestureState.dy) > 5;
            },
            onPanResponderMove: (_, gestureState) => {
                const newY = SCREEN_HEIGHT - MIN_HEIGHT + gestureState.dy;
                if (newY >= SCREEN_HEIGHT - MAX_HEIGHT && newY <= SCREEN_HEIGHT - MIN_HEIGHT) {
                    translateY.setValue(newY);
                }
            },
            onPanResponderRelease: (_, gestureState) => {
                const currentY = SCREEN_HEIGHT - MIN_HEIGHT + gestureState.dy;

                if (gestureState.dy < -100) {
                    Animated.spring(translateY, {
                        toValue: SCREEN_HEIGHT - MAX_HEIGHT,
                        useNativeDriver: true,
                    }).start();
                } else if (gestureState.dy > 100) {
                    Animated.spring(translateY, {
                        toValue: SCREEN_HEIGHT - MIN_HEIGHT,
                        useNativeDriver: true,
                    }).start();
                } else {
                    Animated.spring(translateY, {
                        toValue: currentY < SCREEN_HEIGHT - (MAX_HEIGHT + MIN_HEIGHT) / 2
                            ? SCREEN_HEIGHT - MAX_HEIGHT
                            : SCREEN_HEIGHT - MIN_HEIGHT,
                        useNativeDriver: true,
                    }).start();
                }
            },
        })
    ).current;

    return (
        <Animated.View
            {...panResponder.panHandlers}
            className="absolute left-0 right-0 bottom-0 bg-white rounded-t-3xl shadow-2xl"
            style={{
                height: MAX_HEIGHT,
                transform: [{ translateY }],
            }}
        >
            <View className="items-center py-3">
                <View className="w-12 h-1.5 bg-gray-300 rounded-full" />
            </View>
            <View className="px-4 pb-4">
                {children}
            </View>
        </Animated.View>
    );
};
