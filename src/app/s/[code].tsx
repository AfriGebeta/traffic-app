import { useEffect } from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming,
} from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { shareService } from '../../shared/services/share.service';
import { useTheme } from '../../shared/theme/ThemeContext';
import { showToast } from '../../shared/utils/toast';

const errorMessage = (status?: number): string => {
    if (status === 404) return 'Link not found: This shared location does not exist';
    if (status === 410) return 'Link expired: This shared location is no longer available';
    if (status === 403) return 'Not available: This location was not shared with you';
    return 'Error: Could not open shared location. Check your connection and try again';
};

const PIN_SIZE = 56;
const RING_SIZE = 64;

function DroppingPin({ color }: { color: string }) {
    const lift = useSharedValue(0);
    const ripple = useSharedValue(0);

    useEffect(() => {
        lift.value = withRepeat(
            withSequence(
                withTiming(-18, { duration: 450, easing: Easing.out(Easing.quad) }),
                withTiming(0, { duration: 450, easing: Easing.in(Easing.quad) })
            ),
            -1
        );
        ripple.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) }), -1);
    }, []);

    const pinStyle = useAnimatedStyle(() => ({ transform: [{ translateY: lift.value }] }));
    const ringStyle = useAnimatedStyle(() => ({
        opacity: 0.5 * (1 - ripple.value),
        transform: [{ scaleX: 0.4 + ripple.value }, { scaleY: 0.15 + ripple.value * 0.25 }],
    }));

    return (
        <View className="items-center justify-end" style={{ height: PIN_SIZE + 24 }}>
            <Animated.View
                style={[
                    { position: 'absolute', bottom: 0, width: RING_SIZE, height: RING_SIZE, borderRadius: RING_SIZE / 2, backgroundColor: color },
                    ringStyle,
                ]}
            />
            <Animated.View style={[{ marginBottom: 4 }, pinStyle]}>
                <Ionicons name="location" size={PIN_SIZE} color={color} />
            </Animated.View>
        </View>
    );
}

export default function ShareCodeScreen() {
    const { code } = useLocalSearchParams<{ code: string }>();
    const router = useRouter();
    const { colors: theme } = useTheme();

    useEffect(() => {
        let cancelled = false;

        const open = async () => {
            const { data, status } = await shareService.resolve(String(code));
            if (cancelled) return;

            if (!data) {
                showToast(errorMessage(status));
                router.replace('/');
                return;
            }

            const { location, sender } = data;
            router.replace({
                pathname: '/',
                params: {
                    sharedLat: location.lat.toString(),
                    sharedLng: location.lng.toString(),
                    sharedName: location.name || '',
                    sharedCity: location.city || '',
                    sharedCountry: location.country || '',
                    sharedType: location.type || '',
                },
            });

            const place = location.name || 'shared location';
            showToast(sender?.name ? `${sender.name} shared ${place} with you` : `Opening ${place}`);
        };

        void open();
        return () => {
            cancelled = true;
        };
    }, [code]);

    return (
        <View className="flex-1 items-center justify-center" style={{ backgroundColor: theme.background }}>
            <DroppingPin color={theme.primary} />
            <Text className="mt-5 text-base" style={{ color: theme.textSecondary }}>
                Opening shared location...
            </Text>
        </View>
    );
}
