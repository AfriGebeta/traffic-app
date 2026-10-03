import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
    FadeIn,
    FadeOut,
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withSequence,
    withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getIncidentColor, getIncidentIconName } from '../../incidents/utils/incidentIcons';
import { IncidentTypeFromAPI } from '../../incidents/types/incident.types';
import { incidentService } from '../../incidents/services/incident.service';
import { showToast } from '../../../shared/utils/toast';
import { useTranslation } from 'react-i18next';

interface IncidentAlertProps {
    incidentId: string;
    incidentName: string;
    distance: string;
    distanceKm: number;
    incidentType: IncidentTypeFromAPI;
    onDismiss?: () => void;
    topOffset?: number;
}

const ICON_SIZE = 52;
const LABEL_HEIGHT = 40;
const REVEAL_HOLD_MS = 7000;
const VOTE_DISTANCE_KM = 0.15;
const VOTE_BUTTON_SIZE = 32;

export const IncidentAlert: React.FC<IncidentAlertProps> = ({
    incidentId,
    incidentName,
    distance,
    distanceKm,
    incidentType,
    topOffset = 155,
}) => {
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const color = getIncidentColor(incidentType);
    const iconName = getIncidentIconName(incidentType) as keyof typeof Ionicons.glyphMap;

    const [isVoting, setIsVoting] = useState(false);
    const [votedFor, setVotedFor] = useState<string | null>(null);
    const showVoteButtons = distanceKm <= VOTE_DISTANCE_KM && votedFor !== incidentId;

    const handleVote = async (direction: 'up' | 'down') => {
        if (isVoting) return;

        setIsVoting(true);
        try {
            const response =
                direction === 'up'
                    ? await incidentService.upvote(incidentId)
                    : await incidentService.downvote(incidentId);
            if (response.error) {
                showToast(`${t('failed-to-vote')}: ${response.error}`);
            } else {
                setVotedFor(incidentId);
                showToast(`${t('thanks')} ${t('feedback-helps-others')}`);
            }
        } catch (error) {
            showToast(`${t('failed-to-vote')}. ${t('please-try-again')}`);
        } finally {
            setIsVoting(false);
        }
    };

    const [contentWidth, setContentWidth] = useState(0);
    const progress = useSharedValue(0);
    const revealedForRef = useRef<string | null>(null);

    const label = distance ? `${incidentName}  ·  ${distance}` : incidentName;

    const runReveal = () => {
        if (contentWidth <= 0) return;
        progress.value = 0;
        progress.value = withSequence(
            withTiming(1, { duration: 350, easing: Easing.out(Easing.cubic) }),
            withDelay(REVEAL_HOLD_MS, withTiming(0, { duration: 300, easing: Easing.in(Easing.cubic) }))
        );
    };

    useEffect(() => {
        if (contentWidth <= 0) return;
        if (revealedForRef.current === incidentId) return;
        revealedForRef.current = incidentId;
        runReveal();
    }, [contentWidth, incidentId]);

    const labelStyle = useAnimatedStyle(() => ({
        width: progress.value * contentWidth,
        opacity: progress.value,
    }));

    return (
        <Animated.View
            entering={FadeIn.duration(250)}
            exiting={FadeOut.duration(250)}
            style={{
                position: 'absolute',
                top: insets.top + topOffset,
                right: 16,
                zIndex: 10000,
                elevation: 10,
                alignItems: 'flex-end',
            }}
        >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Animated.View style={[{ overflow: 'hidden' }, labelStyle]}>
                    <View
                        style={{
                            backgroundColor: color,
                            height: LABEL_HEIGHT,
                            borderTopLeftRadius: LABEL_HEIGHT / 2,
                            borderBottomLeftRadius: LABEL_HEIGHT / 2,
                            paddingLeft: 16,
                            paddingRight: 24,
                            justifyContent: 'center',
                        }}
                    >
                        <Text numberOfLines={1} style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>
                            {label}
                        </Text>
                    </View>
                </Animated.View>

                <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={runReveal}
                    style={{
                        width: ICON_SIZE,
                        height: ICON_SIZE,
                        borderRadius: ICON_SIZE / 2,
                        backgroundColor: color,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: 3,
                        borderColor: '#fff',
                        marginLeft: -16,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.25,
                        shadowRadius: 4,
                        elevation: 6,
                    }}
                >
                    <Ionicons name={iconName} size={26} color="#fff" />
                </TouchableOpacity>

                <View
                    pointerEvents="none"
                    style={{ position: 'absolute', opacity: 0, right: 0 }}
                    onLayout={(e) => setContentWidth(e.nativeEvent.layout.width)}
                >
                    <View style={{ paddingLeft: 16, paddingRight: 24 }}>
                        <Text style={{ fontWeight: '700', fontSize: 15 }}>{label}</Text>
                    </View>
                </View>
            </View>

            {showVoteButtons && (
                <Animated.View
                    entering={FadeIn.duration(200)}
                    exiting={FadeOut.duration(200)}
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        marginTop: 8,
                        paddingLeft: 14,
                        paddingRight: 4,
                        paddingVertical: 4,
                        borderRadius: (VOTE_BUTTON_SIZE + 8) / 2,
                        backgroundColor: color,
                        borderWidth: 2,
                        borderColor: '#fff',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.25,
                        shadowRadius: 4,
                        elevation: 6,
                    }}
                >
                    <Text
                        style={{
                            color: '#fff',
                            fontWeight: '700',
                            fontSize: 13,
                            marginRight: 4,
                        }}
                    >
                        {t('still-there')}
                    </Text>
                    {(['up', 'down'] as const).map((direction) => (
                        <TouchableOpacity
                            key={direction}
                            onPress={() => handleVote(direction)}
                            disabled={isVoting}
                            activeOpacity={0.7}
                            style={{
                                width: VOTE_BUTTON_SIZE,
                                height: VOTE_BUTTON_SIZE,
                                borderRadius: VOTE_BUTTON_SIZE / 2,
                                backgroundColor: 'rgba(255, 255, 255, 0.25)',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginLeft: 6,
                            }}
                        >
                            {isVoting ? (
                                <ActivityIndicator color="#fff" size="small" />
                            ) : (
                                <Ionicons name={direction === 'up' ? 'checkmark' : 'close'} size={18} color="#fff" />
                            )}
                        </TouchableOpacity>
                    ))}
                </Animated.View>
            )}
        </Animated.View>
    );
};
