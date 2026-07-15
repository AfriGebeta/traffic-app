import React from 'react';
import { View, Dimensions, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
} from 'react-native-reanimated';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const MIN_HEIGHT = 200;
const MAX_HEIGHT = SCREEN_HEIGHT - 5; 

interface BottomSheetProps {
    children: React.ReactNode;
    expandWhenOpen?: boolean;
}

const BottomSheetComponent: React.FC<BottomSheetProps> = ({ children, expandWhenOpen = false }) => {
    const translateY = useSharedValue(SCREEN_HEIGHT - MIN_HEIGHT);
    const context = useSharedValue({ y: 0 });

    // auto expand for the lists
    React.useEffect(() => {
        if (expandWhenOpen) {
            translateY.value = withSpring(SCREEN_HEIGHT - MAX_HEIGHT, {
                damping: 25,
                stiffness: 250,
                overshootClamping: true,
            });
        } else {
            translateY.value = withSpring(SCREEN_HEIGHT - MIN_HEIGHT, {
                damping: 25,
                stiffness: 250,
                overshootClamping: true,
            });
        }
    }, [expandWhenOpen]);

    const gesture = Gesture.Pan()
        .onStart(() => {
            context.value = { y: translateY.value };
        })
        .onUpdate((event) => {
            const newY = context.value.y + event.translationY;
            if (newY >= SCREEN_HEIGHT - MAX_HEIGHT && newY <= SCREEN_HEIGHT - MIN_HEIGHT) {
                translateY.value = newY;
            }
        })
        .onEnd((event) => {
            const currentY = translateY.value;

            if (event.velocityY < -500) {
                translateY.value = withSpring(SCREEN_HEIGHT - MAX_HEIGHT, {
                    damping: 25,
                    stiffness: 250,
                    overshootClamping: true,
                });
            } else if (event.velocityY > 500) {
                translateY.value = withSpring(SCREEN_HEIGHT - MIN_HEIGHT, {
                    damping: 25,
                    stiffness: 250,
                    overshootClamping: true,
                });
            } else {
                const midPoint = SCREEN_HEIGHT - (MAX_HEIGHT + MIN_HEIGHT) / 2;
                translateY.value = withSpring(
                    currentY < midPoint ? SCREEN_HEIGHT - MAX_HEIGHT : SCREEN_HEIGHT - MIN_HEIGHT,
                    {
                        damping: 25,
                        stiffness: 250,
                        overshootClamping: true,
                    }
                );
            }
        });

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
    }));

    return (
        <GestureDetector gesture={gesture}>
            <Animated.View style={[styles.container, animatedStyle]}>
                <View style={styles.handle}>
                    <View style={styles.handleBar} />
                </View>
                <View style={styles.content}>{children}</View>
            </Animated.View>
        </GestureDetector>
    );
};

BottomSheetComponent.displayName = 'BottomSheet';

export const BottomSheet = React.memo(BottomSheetComponent);

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: MAX_HEIGHT,
        backgroundColor: 'white',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 5,
    },
    handle: {
        alignItems: 'center',
        paddingVertical: 12,
    },
    handleBar: {
        width: 48,
        height: 6,
        backgroundColor: '#D1D5DB',
        borderRadius: 3,
    },
    content: {
        paddingHorizontal: 16,
        paddingBottom: 16,
    },
});
