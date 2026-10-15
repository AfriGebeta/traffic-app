import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors } from '../../../shared/theme/colors';
import { subscribePointsPopup } from '../utils/pointsPopup';

const RISE_PX = 40;
const VISIBLE_MS = 1600;

export function PointsPopupHost() {
    const { t } = useTranslation();
    const [points, setPoints] = useState<number | null>(null);
    const progress = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        return subscribePointsPopup((value) => {
            setPoints(value);
            progress.stopAnimation();
            progress.setValue(0);
            Animated.sequence([
                Animated.timing(progress, { toValue: 1, duration: 250, useNativeDriver: true }),
                Animated.delay(VISIBLE_MS),
                Animated.timing(progress, { toValue: 2, duration: 400, useNativeDriver: true }),
            ]).start(({ finished }) => {
                if (finished) setPoints(null);
            });
        });
    }, [progress]);

    if (points === null) return null;

    const opacity = progress.interpolate({ inputRange: [0, 1, 2], outputRange: [0, 1, 0] });
    // comes up from the bottom edge, settles, then drifts up a little while fading
    const translateY = progress.interpolate({ inputRange: [0, 1, 2], outputRange: [RISE_PX, 0, -RISE_PX / 3] });

    return (
        <Animated.View pointerEvents="none" style={[styles.container, { opacity, transform: [{ translateY }] }]}>
            <Animated.View style={styles.pill}>
                <Text style={styles.text}>
                    <Text style={styles.points}>+{points} </Text>
                    {t('campaign-points-pending')}
                </Text>
            </Animated.View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        left: 0,
        right: 0,
        // just above the success toast (bottom: 90) so the two don't overlap
        bottom: 140,
        alignItems: 'center',
        zIndex: 10001,
        elevation: 12,
    },
    pill: {
        backgroundColor: colors.primary.main,
        borderRadius: 16,
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderWidth: 1.5,
        borderColor: '#fff',
    },
    text: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
    },
    points: {
        fontWeight: '800',
        fontSize: 14,
    },
});
