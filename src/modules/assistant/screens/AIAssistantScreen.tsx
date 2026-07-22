import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Animated, Easing } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import AiIcon from '../../../../assets/images/ai-icon.svg';
import { useVoiceNavigation } from '../../navigation/hooks/useVoiceNavigation';
import { navigationService } from '../../navigation/services/navigation.service';
import { useUserLocation } from '../../map/hooks/useUserLocation';
import { colors } from '../../../shared/theme/colors';
import { useTheme } from '../../../shared/theme/ThemeContext';
import type { GeocodingPlace } from '../../navigation/types/navigation.types';
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

function MicPulse({ active, level }: { active: boolean; level: number }) {
    const outerAnim = useRef(new Animated.Value(0)).current;
    const innerAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (!active) {
            Animated.parallel([
                Animated.timing(outerAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
                Animated.timing(innerAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
            ]).start();
            return;
        }

        Animated.parallel([
            Animated.timing(outerAnim, {
                toValue: level,
                duration: 100,
                easing: Easing.out(Easing.ease),
                useNativeDriver: true,
            }),
            Animated.timing(innerAnim, {
                toValue: level,
                duration: 100,
                easing: Easing.out(Easing.ease),
                useNativeDriver: true,
            }),
        ]).start();
    }, [active, level]);

    const outerScale = outerAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.1] });
    const outerOpacity = outerAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.18] });
    const innerScale = innerAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.55] });
    const innerOpacity = innerAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.3] });

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

export default function AIAssistantScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const { userLocation } = useUserLocation();
    const { colors: theme, isDark } = useTheme();

    const dummyMapRef = useRef<GebetaMapRef | null>(null);

    useEffect(() => {
        Audio.requestPermissionsAsync().catch(() => {});
    }, []);

    const {
        isRecording,
        isProcessingVoice,
        transcription,
        assistantMessage,
        meteringLevel,
        isSpeaking,
        canReplay,
        replayResponse,
        options,
        showOptions,
        handleVoiceStart,
        handleVoiceStop,
        handleOptionSelect,
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
    });

    const isIdle = !isRecording && !isProcessingVoice && !transcription && !assistantMessage && !showOptions;
    const isRecordingBlank = isRecording && !transcription && !assistantMessage && !showOptions;

    return (
        <View className="flex-1" style={{ paddingTop: insets.top, paddingBottom: insets.bottom, backgroundColor: theme.background }}>
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
                    className="flex-1 px-5"
                    contentContainerStyle={{ paddingVertical: 12 }}
                    keyboardShouldPersistTaps="handled"
                >
                    {transcription ? (
                        <View className="self-end max-w-[85%] mb-3 px-4 py-3 rounded-2xl rounded-tr-sm" style={{ backgroundColor: theme.primaryMuted }}>
                            <Text className="text-xs mb-1" style={{ color: colors.primary.main, fontFamily: 'PlusJakartaSans-Medium' }}>
                                {t('you-said')}
                            </Text>
                            <Text className="text-base" style={{ color: theme.textPrimary, fontFamily: 'PlusJakartaSans-Regular' }}>{transcription}</Text>
                        </View>
                    ) : null}

                    {assistantMessage ? (
                        <View className="self-start max-w-[90%] mb-3 px-4 py-3 rounded-2xl rounded-tl-sm" style={{ backgroundColor: theme.surface }}>
                            <Text className="text-base leading-6" style={{ color: theme.textPrimary, fontFamily: 'PlusJakartaSans-Regular' }}>{assistantMessage}</Text>
                        </View>
                    ) : null}

                    {assistantMessage && canReplay && !isSpeaking ? (
                        <TouchableOpacity
                            onPress={replayResponse}
                            className="self-start flex-row items-center mb-3 px-3 py-2 rounded-full"
                            style={{ backgroundColor: theme.surface }}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="play" size={16} color={colors.primary.main} />
                            <Text className="text-sm ml-1.5" style={{ color: colors.primary.main, fontFamily: 'PlusJakartaSans-Medium' }}>
                                {t('play-again')}
                            </Text>
                        </TouchableOpacity>
                    ) : null}

                    {showOptions
                        ? options.map((option) => (
                              <TouchableOpacity
                                  key={option.id}
                                  onPress={() => handleOptionSelect(option.id)}
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
                          ))
                        : null}

                    {isProcessingVoice ? (
                        <View className="flex-row items-center self-start mb-3 px-4 py-3">
                            <ActivityIndicator size="small" color={colors.primary.main} />
                            <Text className="text-sm ml-2" style={{ color: theme.textSecondary, fontFamily: 'PlusJakartaSans-Regular' }}>{t('processing')}</Text>
                        </View>
                    ) : null}
                </ScrollView>
            )}

            <View className="items-center pb-6 pt-2">
                <View style={{ width: MIC_SIZE, height: MIC_SIZE, alignItems: 'center', justifyContent: 'center' }}>
                    <View style={{ position: 'absolute' }}>
                        <MicPulse active={isRecording} level={meteringLevel} />
                    </View>
                    <TouchableOpacity
                        onPressIn={handleVoiceStart}
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
                <Text className="text-xs mt-3" style={{ color: theme.textSecondary, fontFamily: 'PlusJakartaSans-Regular' }}>
                    {isProcessingVoice
                        ? t('processing')
                        : isRecording
                          ? t('listening')
                          : showOptions
                            ? t('or-speak-your-answer')
                            : t('push-to-talk')}
                </Text>
            </View>
        </View>
    );
}
