import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { useLayout, LAYOUT_GUTTER, PANEL_WIDTH } from '../layout/useLayout';

const MIN_HEIGHT = 200;

interface BottomSheetProps {
    children: React.ReactNode;
    expandWhenOpen?: boolean;
}

export const BottomSheet: React.FC<BottomSheetProps> = React.memo(({ children, expandWhenOpen = false }) => {
    const { colors: theme, isDark } = useTheme();
    // read live (not at module load) so rotation keeps the sheet on screen
    const { height: SCREEN_HEIGHT } = useWindowDimensions();
    const MAX_HEIGHT = SCREEN_HEIGHT - 5;
    const insets = useSafeAreaInsets();
    const { isMedium, isWide, centeredInset } = useLayout();
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
    }, [expandWhenOpen, SCREEN_HEIGHT]);

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

    // medium: centered, capped width. wide: left-docked panel so the map stays visible
    const placement = isWide
        ? { left: insets.left + LAYOUT_GUTTER, right: undefined, width: PANEL_WIDTH }
        : isMedium
            ? { left: centeredInset(), right: centeredInset() }
            : null;

    return (
        <Animated.View style={[styles.container, { height: MAX_HEIGHT, backgroundColor: theme.background }, placement, animatedStyle]}>
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
