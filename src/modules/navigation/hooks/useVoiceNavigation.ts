import { useState } from 'react';
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

    const handleVoicePress = async () => {
        if (isRecording) {
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
            // Don't show toast here - the overlay will show "Processing..."

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
                    // Check for specific error messages
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

                // Show transcription
                showToast.success('Understood', response.transcription);

                // Store navigation data
                setNavigationData(response.navigationData);

                // Convert to GeocodingPlace format for normal navigation
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

                    // Trigger the normal navigation flow
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
                console.error('Voice navigation error:', error);
                showToast.error('Something went wrong', 'Please try again');
            } finally {
                setIsProcessing(false);
            }
        } else {
            // Start recording
            const started = await startRecording();
            if (started) {
                // Don't show toast here - the overlay will show "Listening..."
            }
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
        clearVoiceNavigation,
        cancelRecording,
    };
};
