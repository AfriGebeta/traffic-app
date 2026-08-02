import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { subscribeToast } from '../utils/toast';

export function ToastHost() {
    const [message, setMessage] = useState<string | null>(null);
    const opacity = useRef(new Animated.Value(0)).current;
    const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        return subscribeToast((msg) => {
            if (hideTimer.current) clearTimeout(hideTimer.current);

            setMessage(msg);
            opacity.setValue(0);
            Animated.timing(opacity, {
                toValue: 1,
                duration: 150,
                useNativeDriver: true,
            }).start();

            hideTimer.current = setTimeout(() => {
                Animated.timing(opacity, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true,
                }).start(() => setMessage(null));
            }, 2000);
        });
    }, [opacity]);

    if (!message) return null;

    return (
        <Animated.View pointerEvents="none" style={[styles.container, { opacity }]}>
            <View style={styles.pill}>
                <Text style={styles.text}>{message}</Text>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 90,
        alignItems: 'center',
        zIndex: 9999,
    },
    pill: {
        maxWidth: '80%',
        backgroundColor: 'rgba(90,90,90,0.85)',
        borderRadius: 20,
        paddingVertical: 10,
        paddingHorizontal: 18,
    },
    text: {
        color: '#fff',
        fontSize: 14,
        textAlign: 'center',
    },
});
