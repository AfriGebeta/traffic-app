import { useState, useRef } from 'react';
import { useVoiceRecording } from './useVoiceRecording';
import { voiceNavigationService } from '../services/voice-navigation.service';
import { showToast } from '../../../shared/utils/toast';
import type { GebetaMapRef } from '../../../lib/gebeta-map/GebetaMap';
import type { VoiceNavigationData } from '../types/voice-navigation.types';
import type { GeocodingPlace } from '../types/navigation.types';

interface UseVoiceNavigationProps {
    mapRef: React.RefObject<GebetaMapRef | null>;
    userLocation: { lat: number; lng: number } | null;
    language?: string;
    onDestinationFound?: (destination: GeocodingPlace) => void;
}

export const useVoiceNavigation = ({
    mapRef,
    userLocation,
    language = 'amh',
    onDestinationFound,
}: UseVoiceNavigationProps) => {
    const {
        isRecording,
        isProcessing,
        setIsProcessing,
        startRecording,
        stopRecording,
        cancelRecording,
    } = useVoiceRecording();

    const [navigationData, setNavigationData] = useState<VoiceNavigationData | null>(null);
    const recordingStartTime = useRef<number | null>(null);
    const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleVoiceStart = async () => {
        if (!isRecording && !isProcessing) {
            recordingStartTime.current = Date.now();

            holdTimer.current = setTimeout(async () => {
                holdTimer.current = null;
                const started = await startRecording();
                if (!started) {
                    showToast.error('Recording Error', 'Failed to start recording');
                    recordingStartTime.current = null;
                }
            }, 1000);
        }
    };

    const handleVoiceStop = async () => {

        if (holdTimer.current) {
            clearTimeout(holdTimer.current);
            holdTimer.current = null;
            recordingStartTime.current = null;
            showToast.info('Press and hold', 'Hold the button to speak');
            return;
        }

        if (!recordingStartTime.current) {
            return;
        }

        if (isRecording) {
            recordingStartTime.current = null;

            // Stop recording and process
            const audioUri = await stopRecording();
            if (!audioUri) {
                showToast.error('Recording Error', 'Failed to save recording');
                return;
            }

            if (!userLocation) {
                showToast.error('Location Error', 'Current location not available');
                return;
            }

            setIsProcessing(true);

            try {
                const response = await voiceNavigationService.processVoiceNavigation(
                    audioUri,
                    language,
                    userLocation.lat,
                    userLocation.lng
                );

                if (!response) {
                    showToast.error('Could not understand', 'Please speak clearly and try again');
                    return;
                }

                if (!response.success) {
                    const errorMsg = response?.message || '';
                    if (errorMsg.includes('Transcription failed') || errorMsg.includes('empty text')) {
                        showToast.error('Could not hear you', 'Please speak louder and try again');
                    } else if (errorMsg.includes('destination')) {
                        showToast.error('Destination not found', 'Please try saying the place name differently');
                    } else {
                        showToast.error('Could not understand', 'Please try again');
                    }
                    return;
                }

                showToast.success('Understood', response.transcription);
                setNavigationData(response.navigationData);

                if (response.navigationData?.destination) {
                    const dest = response.navigationData.destination;
                    const geocodingPlace: GeocodingPlace = {
                        name: dest.name,
                        latitude: dest.latitude,
                        longitude: dest.longitude,
                        Country: dest.Country,
                        City: dest.City,
                        type: dest.type,
                    };

                    if (onDestinationFound) {
                        onDestinationFound(geocodingPlace);
                    }

                    const distanceKm = response.navigationData.route?.trip?.legs?.[0]?.summary?.length?.toFixed(2) || '0';
                    const durationMin = Math.round((response.navigationData.route?.trip?.legs?.[0]?.summary?.time || 0) / 60);
                    showToast.success('Route Found', `${distanceKm} km • ${durationMin} min`);
                } else {
                    showToast.error('Route not found', 'Could not find a route to this destination');
                }
            } catch (error) {
                showToast.error('Something went wrong', 'Please try again');
            } finally {
                setIsProcessing(false);
            }
        }
    };

    const handleVoicePress = async () => {
        if (isRecording) {
            await handleVoiceStop();
        } else {
            await handleVoiceStart();
        }
    };

    const clearVoiceNavigation = () => {
        setNavigationData(null);
        mapRef.current?.clearRoute();
    };

    return {
        isRecording,
        isProcessingVoice: isProcessing,
        navigationData,
        handleVoicePress,
        handleVoiceStart,
        handleVoiceStop,
        clearVoiceNavigation,
        cancelRecording,
    };
};
