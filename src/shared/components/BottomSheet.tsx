import React from 'react';
import { View, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
} from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeContext';
import { useLayout, PANEL_WIDTH } from '../layout/useLayout';

const MIN_HEIGHT = 200;

interface BottomSheetProps {
    children: React.ReactNode;
    expandWhenOpen?: boolean;
    onBackdropPress?: () => void;
}

export const BottomSheet: React.FC<BottomSheetProps> = React.memo(({ children, expandWhenOpen = false, onBackdropPress }) => {
    const { colors: theme, isDark } = useTheme();
    // read live (not at module load) so rotation keeps the sheet on screen
    const { height: SCREEN_HEIGHT } = useWindowDimensions();
    const MAX_HEIGHT = SCREEN_HEIGHT - 5;
    const { isCompact, isMedium, isWide, centeredInset, panelLeft } = useLayout();
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
        ? { left: panelLeft(), right: 'auto' as const, width: PANEL_WIDTH }
        : isMedium
            ? { left: centeredInset(), right: centeredInset() }
            : null;

    const sheet = (
        <Animated.View style={[styles.container, { height: MAX_HEIGHT, backgroundColor: theme.background }, placement, animatedStyle]}>
            <GestureDetector gesture={gesture}>
                <View style={styles.handle}>
                    <View style={[styles.handleBar, isDark && { backgroundColor: theme.border }]} />
                </View>
            </GestureDetector>
            <View style={styles.content}>{children}</View>
        </Animated.View>
    );

    if (isCompact) return sheet;

    return (
        <>
            <Pressable style={[StyleSheet.absoluteFill, styles.backdrop]} onPress={onBackdropPress} />
            {sheet}
        </>
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
    backdrop: {
        zIndex: 29,
        backgroundColor: 'rgba(0,0,0,0.15)',
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
