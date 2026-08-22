import React, { useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Animated,
    Easing,
    TextInput,
} from 'react-native';
import Reanimated, { useAnimatedKeyboard, useAnimatedStyle } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import AiIcon from '../../../../assets/images/ai-icon.svg';
import TaxiPlanCard from '../components/TaxiPlanCard';
import { useVoiceNavigation } from '../../navigation/hooks/useVoiceNavigation';
import { navigationService } from '../../navigation/services/navigation.service';
import { useUserLocation } from '../../map/hooks/useUserLocation';
import { colors } from '../../../shared/theme/colors';
import { useTheme } from '../../../shared/theme/ThemeContext';
import type { GeocodingPlace } from '../../navigation/types/navigation.types';
import type { TaxiNavigationResponse } from '../../taxi/types/taxi.types';
import type { GebetaMapRef } from '@gebeta/tiles-react-native';

const WAVEFORM_BARS = 9;
const BAR_HEIGHT = 72;

function VoiceWaveform({ active }: { active: boolean }) {
    const anims = useRef(
        Array.from({ length: WAVEFORM_BARS }, () => new Animated.Value(0.25))
    ).current;
    const loopsRef = useRef<Animated.CompositeAnimation[]>([]);

    useEffect(() => {
        if (!active) {
            loopsRef.current.forEach((loop) => loop.stop());
            loopsRef.current = [];
            anims.forEach((anim) => anim.setValue(0.25));
            return;
        }

        loopsRef.current = anims.map((anim, i) => {
            const duration = 350 + Math.random() * 250;
            const loop = Animated.loop(
                Animated.sequence([
                    Animated.timing(anim, {
                        toValue: 0.3 + Math.random() * 0.7,
                        duration,
                        easing: Easing.inOut(Easing.ease),
                        useNativeDriver: true,
                        delay: i * 40,
                    }),
                    Animated.timing(anim, {
                        toValue: 0.15 + Math.random() * 0.3,
                        duration,
                        easing: Easing.inOut(Easing.ease),
                        useNativeDriver: true,
                    }),
                ])
            );
            loop.start();
            return loop;
        });

        return () => {
            loopsRef.current.forEach((loop) => loop.stop());
            loopsRef.current = [];
        };
    }, [active]);

    return (
        <View className="flex-row items-center justify-center" style={{ height: BAR_HEIGHT, gap: 6 }}>
            {anims.map((anim, i) => (
                <Animated.View
                    key={i}
                    style={{
                        width: 8,
                        height: BAR_HEIGHT,
                        borderRadius: 4,
                        backgroundColor: '#FFA500',
                        transform: [{ scaleY: anim }],
                    }}
                />
            ))}
        </View>
    );
}

const MIC_SIZE = 72;

function MicPulse({ active }: { active: boolean }) {
    const outerAnim = useRef(new Animated.Value(0)).current;
    const innerAnim = useRef(new Animated.Value(0)).current;
    const loopsRef = useRef<Animated.CompositeAnimation[]>([]);

    useEffect(() => {
        loopsRef.current.forEach((loop) => loop.stop());
        loopsRef.current = [];

        if (!active) {
            outerAnim.setValue(0);
            innerAnim.setValue(0);
            return;
        }

        outerAnim.setValue(0);
        innerAnim.setValue(0);

        const pulse = (anim: Animated.Value, delay: number, duration: number) =>
            Animated.loop(
                Animated.sequence([
                    Animated.timing(anim, {
                        toValue: 1,
                        duration,
                        delay,
                        easing: Easing.out(Easing.ease),
                        useNativeDriver: true,
                    }),
                    Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
                ])
            );

        const outerLoop = pulse(outerAnim, 0, 1100);
        const innerLoop = pulse(innerAnim, 350, 1100);
        loopsRef.current = [outerLoop, innerLoop];
        outerLoop.start();
        innerLoop.start();

        return () => {
            loopsRef.current.forEach((loop) => loop.stop());
            loopsRef.current = [];
        };
    }, [active]);

    const outerScale = outerAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 4.4] });
    const outerOpacity = outerAnim.interpolate({ inputRange: [0, 0.15, 0.6, 1], outputRange: [0, 0.3, 0.12, 0] });
    const innerScale = innerAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 3.5] });
    const innerOpacity = innerAnim.interpolate({ inputRange: [0, 0.15, 0.6, 1], outputRange: [0, 0.35, 0.15, 0] });

    return (
        <View style={{ width: MIC_SIZE, height: MIC_SIZE, alignItems: 'center', justifyContent: 'center' }}>
            <Animated.View
                pointerEvents="none"
                style={{
                    position: 'absolute',
                    width: MIC_SIZE,
                    height: MIC_SIZE,
                    borderRadius: MIC_SIZE / 2,
                    backgroundColor: '#FFA500',
                    opacity: outerOpacity,
                    transform: [{ scale: outerScale }],
                }}
            />
            <Animated.View
                pointerEvents="none"
                style={{
                    position: 'absolute',
                    width: MIC_SIZE,
                    height: MIC_SIZE,
                    borderRadius: MIC_SIZE / 2,
                    backgroundColor: '#FFA500',
                    opacity: innerOpacity,
                    transform: [{ scale: innerScale }],
                }}
            />
        </View>
    );
}

const formatDuration = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

function RecordingTimer({ seconds }: { seconds: number }) {
    const blink = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(blink, { toValue: 0.2, duration: 600, useNativeDriver: true }),
                Animated.timing(blink, { toValue: 1, duration: 600, useNativeDriver: true }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, []);

    return (
        <View className="flex-row items-center">
            <Animated.View
                style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#EF4444', opacity: blink }}
            />
            <Text className="text-sm ml-2" style={{ color: colors.primary.main, fontFamily: 'PlusJakartaSans-Medium' }}>
                {formatDuration(seconds)}
            </Text>
        </View>
    );
}

export default function AIAssistantScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const { userLocation } = useUserLocation();
    const { colors: theme, isDark } = useTheme();

    const dummyMapRef = useRef<GebetaMapRef | null>(null);
    const scrollRef = useRef<ScrollView | null>(null);

    const [recordSeconds, setRecordSeconds] = useState(0);
    const [draft, setDraft] = useState('');
    const [inputMode, setInputMode] = useState<'none' | 'voice' | 'text'>('none');
    const keyboard = useAnimatedKeyboard();

    useEffect(() => {
        Audio.requestPermissionsAsync().catch(() => { });
    }, []);

    const openTaxiNavigation = (route: TaxiNavigationResponse) => {
        router.replace({
            pathname: '/taxi/navigation',
            params: { routeData: JSON.stringify(route) },
        });
    };

    const {
        isRecording,
        isProcessingVoice,
        messages,
        isSpeaking,
        canReplay,
        replayResponse,
        stopSpeaking,
        showOptions,
        handleVoiceStart,
        handleVoiceStop,
        handleOptionSelect,
        handlePlaceSelect,
        startTaxiRoute,
        sendTextMessage,
    } = useVoiceNavigation({
        mapRef: dummyMapRef,
        userLocation,
        language: 'amh',
        onDestinationFound: (place: GeocodingPlace) => {
            if (userLocation) {
                const promise = navigationService
                    .getNavigation({
                        origin: [userLocation.lat, userLocation.lng],
                        destination: [place.latitude, place.longitude],
                        costing: 'auto',
                    })
                    .catch(() => null);
                (globalThis as any).__voiceRoutePrefetch = {
                    key: `${place.latitude},${place.longitude}`,
                    promise,
                };
            }

            router.back();
            setTimeout(() => {
                router.setParams({
                    voiceDestLat: String(place.latitude),
                    voiceDestLng: String(place.longitude),
                    voiceDestName: place.name,
                });
            }, 0);
        },
        onTaxiRouteStarted: openTaxiNavigation,
    });

    useEffect(() => {
        if (!isRecording) {
            setRecordSeconds(0);
            return;
        }
        setRecordSeconds(0);
        const interval = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
        return () => clearInterval(interval);
    }, [isRecording]);

    const hasConversation = messages.length > 0;
    const isIdle = !isRecording && !isProcessingVoice && !hasConversation && !showOptions;
    const isRecordingBlank = isRecording && !hasConversation && !showOptions;
    const lastSpokenId = [...messages].reverse().find((m) => m.role === 'assistant' || m.role === 'taxi' || m.role === 'places')?.id;
    const lastOptionsId = [...messages].reverse().find((m) => m.role === 'options')?.id;

    const canSendDraft = draft.trim().length > 0 && !isRecording && !isProcessingVoice;
    const submitDraft = () => {
        if (!canSendDraft) return;
        const text = draft;
        setDraft('');
        setInputMode('text');
        void sendTextMessage(text);
    };

    useEffect(() => {
        if (messages.length === 0) setInputMode('none');
    }, [messages.length]);

    const bottomBarStyle = useAnimatedStyle(() => ({
        paddingBottom: Math.max(keyboard.height.value, insets.bottom) + 8,
    }));

    const renderAudioControl = (messageId: string) =>
        messageId === lastSpokenId && (isSpeaking || canReplay) ? (
            <TouchableOpacity
                onPress={isSpeaking ? stopSpeaking : replayResponse}
                className="self-start flex-row items-center mb-3 px-3 py-2 rounded-full"
                style={{ backgroundColor: theme.surface }}
                activeOpacity={0.7}
            >
                <Ionicons name={isSpeaking ? 'stop' : 'play'} size={16} color={colors.primary.main} />
                <Text className="text-sm ml-1.5" style={{ color: colors.primary.main, fontFamily: 'PlusJakartaSans-Medium' }}>
                    {isSpeaking ? t('stop') : t('play-again')}
                </Text>
            </TouchableOpacity>
        ) : null;

    return (
        <View className="flex-1" style={{ paddingTop: insets.top, backgroundColor: theme.background }}>
            <View className="flex-row items-center px-4 py-4">
                <TouchableOpacity
                    onPress={() => router.back()}
                    className="flex-row items-center"
                    activeOpacity={0.7}
                >
                    <Ionicons name="chevron-back" size={22} color={theme.textPrimary} />
                    <Text className="text-base ml-1" style={{ color: theme.textPrimary, fontFamily: 'PlusJakartaSans-Medium' }}>{t('welcome')}</Text>
                </TouchableOpacity>
            </View>

            {isRecordingBlank ? (
                <View className="flex-1 items-center justify-center px-8">
                    <VoiceWaveform active={isRecording} />
                    <Text className="text-base mt-6" style={{ color: colors.primary.main, fontFamily: 'PlusJakartaSans-Medium' }}>
                        {t('listening')}
                    </Text>
                </View>
            ) : isIdle ? (
                <View className="flex-1 items-center justify-center px-8">
                    <AiIcon width={100} height={106} />

                    <Text className="text-4xl text-center mt-6 leading-[44px]" style={{ fontFamily: 'PlusJakartaSans-ExtraBold' }}>
                        <Text style={{ color: theme.textPrimary }}>{t('ai-greeting-part1')}</Text>
                        <Text style={{ color: '#FFA500' }}>{t('ai-greeting-highlight1')}</Text>
                        <Text style={{ color: theme.textPrimary }}>{t('ai-greeting-part2')}</Text>
                        <Text style={{ color: '#FFA500' }}>{t('ai-greeting-highlight2')}</Text>
                        <Text style={{ color: theme.textPrimary }}>{t('ai-greeting-part3')}</Text>
                    </Text>
                </View>
            ) : (
                <ScrollView
                    ref={scrollRef}
                    className="flex-1 px-5"
                    contentContainerStyle={{ paddingVertical: 12 }}
                    keyboardShouldPersistTaps="handled"
                    onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
                >
                    {messages.map((message) =>
                        message.role === 'options' ? (
                            <View key={message.id} style={{ opacity: message.id === lastOptionsId ? 1 : 0.5 }}>
                                {(message.options ?? []).map((option) => (
                                    <TouchableOpacity
                                        key={option.id}
                                        onPress={() => handleOptionSelect(option.id)}
                                        disabled={message.id !== lastOptionsId}
                                        className="flex-row items-center p-4 mb-2 rounded-xl"
                                        style={{ backgroundColor: theme.surface }}
                                        activeOpacity={0.7}
                                    >
                                        <View
                                            className="w-10 h-10 rounded-full items-center justify-center mr-3"
                                            style={{ backgroundColor: colors.primary.main }}
                                        >
                                            <Ionicons name="location" size={20} color="white" />
                                        </View>
                                        <View className="flex-1">
                                            <Text className="text-base" style={{ color: theme.textPrimary, fontFamily: 'PlusJakartaSans-Medium' }}>{option.name}</Text>
                                            {option.lat != null && option.lng != null && (
                                                <Text className="text-sm mt-1" style={{ color: theme.textSecondary, fontFamily: 'PlusJakartaSans-Regular' }}>
                                                    {option.lat.toFixed(6)}, {option.lng.toFixed(6)}
                                                </Text>
                                            )}
                                        </View>
                                        <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
                                    </TouchableOpacity>
                                ))}
                            </View>
                        ) : message.role === 'places' ? (
                            <View key={message.id}>
                                <View className="mb-3 rounded-2xl rounded-tl-sm overflow-hidden" style={{ backgroundColor: theme.surface }}>
                                    <View className="flex-row items-center px-4 pt-4 pb-2">
                                        <Ionicons name="compass-outline" size={18} color={colors.primary.main} />
                                        <Text className="text-base ml-2" style={{ color: theme.textPrimary, fontFamily: 'PlusJakartaSans-Medium' }}>
                                            {t('nearby-places')}
                                        </Text>
                                    </View>
                                    {(message.options ?? []).map((place) => (
                                        <View key={place.id} className="flex-row items-center px-4 py-3">
                                            <View className="flex-1 mr-3">
                                                <Text className="text-base" numberOfLines={1} style={{ color: theme.textPrimary, fontFamily: 'PlusJakartaSans-Regular' }}>
                                                    {place.name}
                                                </Text>
                                                <Text className="text-xs mt-0.5" style={{ color: theme.textSecondary, fontFamily: 'PlusJakartaSans-Regular' }}>
                                                    {place.lat.toFixed(5)}, {place.lng.toFixed(5)}
                                                </Text>
                                            </View>
                                            <TouchableOpacity
                                                onPress={() => handlePlaceSelect(place)}
                                                className="px-4 py-2 rounded-full"
                                                style={{ backgroundColor: colors.primary.main }}
                                                activeOpacity={0.8}
                                            >
                                                <Text className="text-sm" style={{ color: 'white', fontFamily: 'PlusJakartaSans-Medium' }}>
                                                    {t('go')}
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                </View>
                                {renderAudioControl(message.id)}
                            </View>
                        ) : message.role === 'taxi' && message.taxiPlan ? (
                            <View key={message.id}>
                                <TaxiPlanCard
                                    plan={message.taxiPlan}
                                    onStart={() => {
                                        const { route } = message.taxiPlan!;
                                        if (startTaxiRoute(route)) openTaxiNavigation(route);
                                    }}
                                />
                                {renderAudioControl(message.id)}
                            </View>
                        ) : message.role === 'user' ? (
                            <View
                                key={message.id}
                                className="self-end max-w-[85%] mb-3 px-4 py-3 rounded-2xl rounded-tr-sm"
                                style={{ backgroundColor: theme.primaryMuted }}
                            >
                                <Text className="text-xs mb-1" style={{ color: colors.primary.main, fontFamily: 'PlusJakartaSans-Medium' }}>
                                    {t('you-said')}
                                </Text>
                                <Text className="text-base" style={{ color: theme.textPrimary, fontFamily: 'PlusJakartaSans-Regular' }}>{message.text}</Text>
                            </View>
                        ) : (
                            <View key={message.id}>
                                <View className="self-start max-w-[90%] mb-3 px-4 py-3 rounded-2xl rounded-tl-sm" style={{ backgroundColor: theme.surface }}>
                                    <Text className="text-base leading-6" style={{ color: theme.textPrimary, fontFamily: 'PlusJakartaSans-Regular' }}>{message.text}</Text>
                                </View>

                                {renderAudioControl(message.id)}
                            </View>
                        )
                    )}

                    {isProcessingVoice ? (
                        <View className="flex-row items-center self-start mb-3 px-4 py-3">
                            <ActivityIndicator size="small" color={colors.primary.main} />
                            <Text className="text-sm ml-2" style={{ color: theme.textSecondary, fontFamily: 'PlusJakartaSans-Regular' }}>{t('processing')}</Text>
                        </View>
                    ) : null}
                </ScrollView>
            )}

            <Reanimated.View className="items-center pt-2" style={bottomBarStyle}>
                {inputMode !== 'text' ? (
                    <>
                        <View style={{ width: MIC_SIZE, height: MIC_SIZE, alignItems: 'center', justifyContent: 'center' }}>
                            <View style={{ position: 'absolute' }}>
                                <MicPulse active={isRecording} />
                            </View>
                            <TouchableOpacity
                                onPressIn={() => {
                                    setInputMode('voice');
                                    handleVoiceStart();
                                }}
                                onPressOut={handleVoiceStop}
                                disabled={isProcessingVoice}
                                className="items-center justify-center rounded-full"
                                style={{
                                    width: MIC_SIZE,
                                    height: MIC_SIZE,
                                    backgroundColor: isRecording ? '#FFA500' : 'transparent',
                                    borderWidth: 1,
                                    borderColor: '#FFA500',
                                    opacity: isProcessingVoice ? 0.5 : 1,
                                }}
                                activeOpacity={0.7}
                            >
                                <Ionicons name={isRecording ? 'mic' : 'mic-outline'} size={30} color={isRecording ? 'white' : '#FFA500'} />
                            </TouchableOpacity>
                        </View>
                        <View className="mt-3 h-5 justify-center">
                            {isRecording ? (
                                <RecordingTimer seconds={recordSeconds} />
                            ) : (
                                <Text className="text-xs" style={{ color: theme.textSecondary, fontFamily: 'PlusJakartaSans-Regular' }}>
                                    {isProcessingVoice
                                        ? t('processing')
                                        : isRecording
                                            ? t('listening')
                                            : showOptions
                                                ? t('or-speak-your-answer')
                                                : t('push-to-talk')}
                                </Text>
                            )}
                        </View>
                    </>
                ) : null}

                {inputMode !== 'voice' ? (
                    <View className="flex-row items-center w-full px-5 mt-4">
                        <TextInput
                            value={draft}
                            onChangeText={setDraft}
                            onSubmitEditing={submitDraft}
                            editable={!isRecording && !isProcessingVoice}
                            placeholder={t('type-a-message')}
                            placeholderTextColor={theme.textSecondary}
                            returnKeyType="send"
                            multiline
                            className="flex-1 px-4 py-3 rounded-2xl text-base"
                            style={{
                                backgroundColor: theme.surface,
                                color: theme.textPrimary,
                                fontFamily: 'PlusJakartaSans-Regular',
                                maxHeight: 96,
                                opacity: isRecording || isProcessingVoice ? 0.5 : 1,
                            }}
                        />
                        <TouchableOpacity
                            onPress={submitDraft}
                            disabled={!canSendDraft}
                            className="w-11 h-11 rounded-full items-center justify-center ml-2"
                            style={{
                                backgroundColor: canSendDraft ? colors.primary.main : theme.surface,
                            }}
                            activeOpacity={0.7}
                        >
                            <Ionicons
                                name="arrow-up"
                                size={20}
                                color={canSendDraft ? 'white' : theme.textSecondary}
                            />
                        </TouchableOpacity>
                    </View>
                ) : null}
            </Reanimated.View>
        </View>
    );
}
