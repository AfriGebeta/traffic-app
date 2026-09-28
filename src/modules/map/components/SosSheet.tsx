import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Keyboard,
    Modal,
    Platform,
    Pressable,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { generateLocationUrl } from '../../../shared/utils/deepLinking';
import { openDialer, openSmsComposer, shareLocation } from '../../../shared/utils/shareLocation';
import { showToast } from '../../../shared/utils/toast';
import { AMBULANCE_ICON, FIRE_ICON, POLICE_ICON, SOS_ICON } from './sosIcons';

type LatLng = { lat: number; lng: number };

interface SosSheetProps {
    visible: boolean;
    onClose: () => void;
    userLocation?: LatLng | null;
}

const FIX_TIMEOUT_MS = 5000;

const EMERGENCY_NUMBERS = [
    { key: 'sos-call-police', number: '991', icon: POLICE_ICON },
    { key: 'sos-call-ambulance', number: '907', icon: AMBULANCE_ICON },
    { key: 'sos-call-fire', number: '939', icon: FIRE_ICON },
] as const;

const getFreshFix = async (): Promise<LatLng | null> => {
    try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') return null;
        const fix = await Promise.race([
            Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), FIX_TIMEOUT_MS)),
        ]);
        const pos = fix ?? (await Location.getLastKnownPositionAsync());
        return pos ? { lat: pos.coords.latitude, lng: pos.coords.longitude } : null;
    } catch {
        return null;
    }
};

export const SosSheet: React.FC<SosSheetProps> = ({ visible, onClose, userLocation }) => {
    const { t } = useTranslation();
    const { colors: theme, isDark } = useTheme();
    const SosIcon = isDark ? SOS_ICON.dark : SOS_ICON.light;
    const insets = useSafeAreaInsets();
    const [location, setLocation] = useState<LatLng | null>(null);
    const [locating, setLocating] = useState(false);
    const [message, setMessage] = useState('');
    const editedRef = useRef(false);
    const [keyboardHeight, setKeyboardHeight] = useState(0);

    useEffect(() => {
        if (!visible) return;
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
        const showSub = Keyboard.addListener(showEvent, (e) => setKeyboardHeight(e.endCoordinates.height));
        const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
        return () => {
            showSub.remove();
            hideSub.remove();
            setKeyboardHeight(0);
        };
    }, [visible]);

    const buildMessage = (loc: LatLng | null) => {
        if (!loc) return t('sos-message-no-location');
        const coords = `${loc.lat.toFixed(6)}, ${loc.lng.toFixed(6)}`;
        return t('sos-message', { url: generateLocationUrl(loc), coords });
    };

    useEffect(() => {
        if (!visible) return;
        let cancelled = false;
        editedRef.current = false;
        const initial = userLocation ?? null;
        setLocation(initial);
        setMessage(buildMessage(initial));
        setLocating(true);

        getFreshFix().then((fresh) => {
            if (cancelled) return;
            setLocating(false);
            if (!fresh) return;
            setLocation(fresh);
            if (!editedRef.current) setMessage(buildMessage(fresh));
        });

        return () => {
            cancelled = true;
        };
    }, [visible]);

    const handleChangeMessage = (text: string) => {
        editedRef.current = true;
        setMessage(text);
    };

    const handleSms = async () => {
        try {
            await openSmsComposer(message);
        } catch {
            showToast(t('sos-open-failed'));
        }
    };

    const handleShare = async () => {
        if (!location) {
            showToast(t('sos-no-location'));
            return;
        }
        await shareLocation(location, { message, includeUrl: false });
    };

    const handleCall = async (number: string) => {
        try {
            await openDialer(number);
        } catch {
            showToast(t('sos-open-failed'));
        }
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
            statusBarTranslucent
            navigationBarTranslucent
        >
            <View style={{ flex: 1, justifyContent: 'flex-end' }}>
                <Pressable className="absolute inset-0 bg-black/40" onPress={onClose} />

                <View
                    className="rounded-t-3xl px-5 pt-5"
                    style={{
                        backgroundColor: theme.background,
                        paddingBottom: (keyboardHeight || insets.bottom) + 16,
                    }}
                >
                    <View className="flex-row items-center justify-between">
                        <View className="flex-row items-center">
                            <SosIcon width={28} height={28} />
                            <Text className="ml-2 text-xl font-bold" style={{ color: theme.textPrimary }}>
                                {t('sos-title')}
                            </Text>
                        </View>
                        <TouchableOpacity
                            onPress={onClose}
                            accessibilityRole="button"
                            accessibilityLabel={t('sos-close')}
                            className="p-1"
                        >
                            <Ionicons name="close" size={24} color={theme.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    <View className="mt-2 flex-row items-center">
                        {locating ? (
                            <ActivityIndicator size="small" color={theme.textSecondary} />
                        ) : (
                            <Ionicons
                                name={location ? 'location' : 'location-outline'}
                                size={14}
                                color={location ? theme.green : theme.textSecondary}
                            />
                        )}
                        <Text className="ml-1.5 text-xs" style={{ color: theme.textSecondary }}>
                            {locating
                                ? t('sos-locating')
                                : location
                                    ? `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`
                                    : t('sos-no-location')}
                        </Text>
                    </View>

                    <TextInput
                        value={message}
                        onChangeText={handleChangeMessage}
                        multiline
                        textAlignVertical="top"
                        className="mt-4 rounded-2xl p-3 text-sm"
                        style={{
                            minHeight: 110,
                            maxHeight: 180,
                            color: theme.textPrimary,
                            backgroundColor: theme.surface,
                            borderWidth: 1,
                            borderColor: theme.border,
                        }}
                        placeholderTextColor={theme.textSecondary}
                    />

                    <View className="mt-4 flex-row">
                        <TouchableOpacity
                            onPress={handleSms}
                            className="mr-2 flex-1 flex-row items-center justify-center rounded-2xl py-3.5"
                            style={{ backgroundColor: theme.error }}
                        >
                            <Ionicons name="chatbubble-ellipses" size={18} color="#FFFFFF" />
                            <Text className="ml-2 font-semibold text-white">{t('sos-send-sms')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={handleShare}
                            className="flex-1 flex-row items-center justify-center rounded-2xl py-3.5"
                            style={{ backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }}
                        >
                            <Ionicons name="share-social" size={18} color={theme.textPrimary} />
                            <Text className="ml-2 font-semibold" style={{ color: theme.textPrimary }}>
                                {t('sos-share')}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <Text className="mt-5 text-xs font-semibold uppercase" style={{ color: theme.textSecondary }}>
                        {t('sos-emergency-numbers')}
                    </Text>
                    <View className="mt-2 flex-row">
                        {EMERGENCY_NUMBERS.map(({ key, number, icon }, i) => {
                            const Icon = isDark ? icon.dark : icon.light;
                            return (
                                <TouchableOpacity
                                    key={number}
                                    onPress={() => handleCall(number)}
                                    className={`flex-1 items-center rounded-2xl py-3 ${i < EMERGENCY_NUMBERS.length - 1 ? 'mr-2' : ''}`}
                                    style={{ backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }}
                                >
                                    <Icon width={32} height={32} />
                                    <Text className="mt-1 text-xs" style={{ color: theme.textSecondary }}>
                                        {t(key)}
                                    </Text>
                                    <Text className="text-base font-bold" style={{ color: theme.textPrimary }}>
                                        {number}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>
            </View>
        </Modal>
    );
};
