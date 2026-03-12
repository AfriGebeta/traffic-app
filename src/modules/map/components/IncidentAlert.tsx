import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getIncidentColor } from '../../incidents/utils/incidentIcons';
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
}

const VOTE_DISTANCE_KM = 0.15;

export const IncidentAlert: React.FC<IncidentAlertProps> = ({
    incidentId,
    incidentName,
    distance,
    distanceKm,
    incidentType,
    onDismiss,
}) => {
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const color = getIncidentColor(incidentType);
    const [isVoting, setIsVoting] = useState(false);
    const [hasVoted, setHasVoted] = useState(false);
    const showVoteButtons = distanceKm <= VOTE_DISTANCE_KM && !hasVoted;

    const handleUpvote = async () => {
        if (isVoting) return;

        setIsVoting(true);
        try {
            const response = await incidentService.upvote(incidentId);
            if (response.error) {
                showToast.error(t('failed-to-vote'), response.error);
            } else {
                setHasVoted(true);
                showToast.success(t('thanks'), t('feedback-helps-others'));
            }
        } catch (error) {
            showToast.error(t('failed-to-vote'), t('please-try-again'));
        } finally {
            setIsVoting(false);
        }
    };

    const handleDownvote = async () => {
        if (isVoting) return;

        setIsVoting(true);
        try {
            const response = await incidentService.downvote(incidentId);
            if (response.error) {
                showToast.error(t('failed-to-vote'), response.error);
            } else {
                setHasVoted(true);
                showToast.success(t('thanks'), t('feedback-helps-others'));
            }
        } catch (error) {
            showToast.error(t('failed-to-vote'), t('please-try-again'));
        } finally {
            setIsVoting(false);
        }
    };

    return (
        <Animated.View
            entering={FadeInDown.duration(300)}
            exiting={FadeOutUp.duration(300)}
            style={{
                position: 'absolute',
                top: insets.top + 16,
                left: 16,
                right: 16,
                zIndex: 10000,
                elevation: 10,
            }}
        >
            <View
                className="rounded-2xl shadow-2xl"
                style={{
                    backgroundColor: color,
                    padding: showVoteButtons ? 12 : 20
                }}
            >
                <View className="flex-row items-center">
                    <View
                        className="bg-white/30 rounded-full mr-3"
                        style={{ padding: showVoteButtons ? 8 : 12 }}
                    >
                        <Ionicons
                            name="warning"
                            size={showVoteButtons ? 24 : 32}
                            color="white"
                        />
                    </View>
                    <View className="flex-1">
                        <Text
                            className="text-white font-bold"
                            style={{ fontSize: showVoteButtons ? 16 : 24, marginBottom: 2 }}
                        >
                            {incidentName}
                        </Text>
                        <Text
                            className="text-white font-semibold"
                            style={{ fontSize: showVoteButtons ? 13 : 18 }}
                        >
                            {distance}
                        </Text>
                    </View>
                    {onDismiss && (
                        <TouchableOpacity
                            onPress={onDismiss}
                            style={{
                                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                                borderRadius: 16,
                                width: 32,
                                height: 32,
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="close" size={18} color="white" />
                        </TouchableOpacity>
                    )}
                </View>

                {showVoteButtons && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                        <Text style={{ color: 'white', fontWeight: '600', fontSize: 12, flex: 1 }}>
                            {t('still-there')}
                        </Text>
                        <TouchableOpacity
                            onPress={handleUpvote}
                            disabled={isVoting}
                            style={{
                                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                                borderRadius: 20,
                                width: 36,
                                height: 36,
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginLeft: 8,
                            }}
                            activeOpacity={0.7}
                        >
                            {isVoting ? (
                                <ActivityIndicator color="white" size="small" />
                            ) : (
                                <Ionicons name="checkmark" size={20} color="white" />
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={handleDownvote}
                            disabled={isVoting}
                            style={{
                                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                                borderRadius: 20,
                                width: 36,
                                height: 36,
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginLeft: 8,
                            }}
                            activeOpacity={0.7}
                        >
                            {isVoting ? (
                                <ActivityIndicator color="white" size="small" />
                            ) : (
                                <Ionicons name="close" size={20} color="white" />
                            )}
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        </Animated.View>
    );
};
