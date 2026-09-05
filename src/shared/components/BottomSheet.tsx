import React from 'react';
import { View, Dimensions, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
} from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeContext';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const MIN_HEIGHT = 200;
const MAX_HEIGHT = SCREEN_HEIGHT - 5; 

interface BottomSheetProps {
    children: React.ReactNode;
    expandWhenOpen?: boolean;
}

export const BottomSheet: React.FC<BottomSheetProps> = React.memo(({ children, expandWhenOpen = false }) => {
    const { colors: theme, isDark } = useTheme();
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
        <Animated.View style={[styles.container, { backgroundColor: theme.background }, animatedStyle]}>
            <GestureDetector gesture={gesture}>
                <View style={styles.handle}>
                    <View style={[styles.handleBar, isDark && { backgroundColor: theme.border }]} />
                </View>
            </GestureDetector>
            <View style={styles.content}>{children}</View>
        </Animated.View>
    );
});

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: MAX_HEIGHT,
        zIndex: 30,
        backgroundColor: 'white',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 30,
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
        flex: 1,
        paddingHorizontal: 16,
        paddingBottom: 16,
    },
});
