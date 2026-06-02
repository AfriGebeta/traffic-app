import { useState, useRef } from 'react';
import { Audio } from 'expo-av';
import { useVoiceRecording } from './useVoiceRecording';
import { voiceNavigationService } from '../services/voice-navigation.service';
import { ttsService } from '../services/tts.service';
import { showToast } from '../../../shared/utils/toast';
import { generateSessionId } from '../../../shared/utils/session';
import type { GebetaMapRef } from '@gebeta/tiles-react-native';
import type { VoiceNavigationData, NavigationOption } from '../types/voice-navigation.types';
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
    const [options, setOptions] = useState<NavigationOption[]>([]);
    const [showOptions, setShowOptions] = useState(false);
    const [showVoiceModal, setShowVoiceModal] = useState(false);
    const [transcription, setTranscription] = useState<string>('');
    const sessionIdRef = useRef<string>(generateSessionId());
    const recordingStartTime = useRef<number | null>(null);
    const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const soundRef = useRef<Audio.Sound | null>(null);

    const playTTS = async (text: string) => {
        try {
            if (soundRef.current) {
                await soundRef.current.stopAsync();
                await soundRef.current.unloadAsync();
                soundRef.current = null;
            }

            const audioData = await ttsService.synthesizeSpeech(text, language);
            if (!audioData) {
                console.error('Failed to synthesize speech');
                return;
            }

            const { sound } = await Audio.Sound.createAsync(
                { uri: audioData },
                { shouldPlay: true }
            );

            soundRef.current = sound;

            sound.setOnPlaybackStatusUpdate((status) => {
                if (status.isLoaded && status.didJustFinish) {
                    sound.unloadAsync();
                    soundRef.current = null;
                }
            });
        } catch (error) {
            console.error('Error playing TTS:', error);
        }
    };

    const handleVoiceStart = async () => {
        if (!isRecording && !isProcessing) {

            sessionIdRef.current = generateSessionId();
            recordingStartTime.current = Date.now();

            const started = await startRecording();
            if (!started) {
                showToast.error('Recording Error', 'Failed to start recording');
                recordingStartTime.current = null;
            }
        }
    };

    const handleVoiceStop = async () => {
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
                    sessionIdRef.current,
                    userLocation.lat,
                    userLocation.lng
                );

                console.log('Voice Navigation Response:', {
                    success: response?.success,
                    transcription: response?.transcription,
                    hasNavigationData: !!response?.navigationData,
                    message: response?.message
                });

                if (!response) {
                    showToast.error('Could not understand', 'Please speak clearly and try again');
                    return;
                }

                const userTranscription = response.transcription || '';
                console.log('User transcription:', userTranscription);
                setTranscription(userTranscription);

                if (!response.success) {
                    const errorMsg = response?.message || '';
                    console.log('Error message:', errorMsg);

                    if (userTranscription) {
                        showToast.error(
                            'Could not find destination',
                            `You said: "${userTranscription}"`
                        );
                    } else if (errorMsg.includes('Transcription failed') || errorMsg.includes('empty text')) {
                        showToast.error('Could not hear you', 'Please speak louder and try again');
                    } else if (errorMsg.includes('destination')) {
                        showToast.error('Destination not found', 'Please try saying the place name differently');
                    } else {
                        showToast.error('Could not understand', 'Please try again');
                    }
                    return;
                }

                showToast.success('Understood', userTranscription);

                if (response.navigationData?.options && response.navigationData.options.length > 1) {
                    
                    setOptions(response.navigationData.options);
                    setShowOptions(true);

                    setShowVoiceModal(false);

                    let ttsMessage = response.navigationData.message;
                    if (!ttsMessage && response.navigationData.options.length > 0) {
                        const firstPlace = response.navigationData.options[0].name;
                        ttsMessage = `Found ${response.navigationData.options.length} places. First one is ${firstPlace}. Please select from the list.`;
                    }

                    if (ttsMessage) {
                        playTTS(ttsMessage);
                    }

                    return;
                }

                setNavigationData(response.navigationData);

                if (response.navigationData?.destination) {
                    const dest = response.navigationData.destination;

                    const lat = Number(dest.latitude);
                    const lng = Number(dest.longitude);

                    if (isNaN(lat) || isNaN(lng)) {
                        console.error('Invalid destination coordinates:', { lat: dest.latitude, lng: dest.longitude });
                        showToast.error('Invalid location', 'Could not get coordinates for this place');
                        return;
                    }

                    const geocodingPlace: GeocodingPlace = {
                        name: dest.name,
                        latitude: lat,
                        longitude: lng,
                        location: {
                            lat,
                            lng,
                        },
                        Country: dest.Country || '',
                        City: dest.City || '',
                        type: dest.type || 'place',
                        
                        id: `voice-destination`,
                        display_name: dest.name,
                        category: dest.type || 'place',
                        address: {
                            city: dest.City || '',
                            country: dest.Country || '',
                            country_code: '',
                        },
                    };

                    if (onDestinationFound) {
                        onDestinationFound(geocodingPlace);
                    }

                    const distanceKm = response.navigationData.route?.trip?.legs?.[0]?.summary?.length?.toFixed(2) || '0';
                    const durationMin = Math.round((response.navigationData.route?.trip?.legs?.[0]?.summary?.time || 0) / 60);
                    showToast.success('Route Found', `${distanceKm} km • ${durationMin} min`);
                } else {
                   

                    showToast.error(
                        'Location not recognized',
                        userTranscription ? `Couldn't find "${userTranscription}". Try saying it differently or be more specific.` : 'Could not find this location'
                    );
                }
            } catch (error) {
                showToast.error('Something went wrong', 'Please try again');
            } finally {
                setIsProcessing(false);
                setShowVoiceModal(false);
            }
        }
    };

    const handleVoicePress = async () => {

        setShowVoiceModal(true);
    };

    const handleCloseVoiceModal = () => {
        setShowVoiceModal(false);
        if (isRecording) {
            cancelRecording();
        }
    };

    const clearVoiceNavigation = () => {
        setNavigationData(null);
        setOptions([]);
        setShowOptions(false);
        setTranscription('');
        mapRef.current?.clearRoute();
    };

    const handleOptionSelect = async (optionId: number) => {
        if (!userLocation) {
            showToast.error('Location Error', 'Current location not available');
            return;
        }

        setShowOptions(false);

        const selectedOption = options.find(opt => opt.id === optionId);
      

        if (!selectedOption) {
            showToast.error('Invalid selection', 'Please try again');
            return;
        }

        try {
            showToast.info('Finding location', 'Please wait...');

            const { navigationService } = await import('../../navigation/services/navigation.service');
            const geocodedPlaces = await navigationService.geocodePlace(selectedOption.name);

            if (!geocodedPlaces || geocodedPlaces.length === 0) {
                showToast.error('Location not found', 'Could not find coordinates for this place');
                return;
            }

            const place = geocodedPlaces[0];


            setOptions([]);
            setTranscription('');

            if (onDestinationFound) {
                onDestinationFound(place);
            }


        } catch (error) {
            console.error('Error geocoding place:', error);
            showToast.error('Search failed', 'Could not find this location');
        }
    };

    return {
        isRecording,
        isProcessingVoice: isProcessing,
        navigationData,
        options,
        showOptions,
        showVoiceModal,
        transcription,
        handleVoicePress,
        handleVoiceStart,
        handleVoiceStop,
        handleCloseVoiceModal,
        handleOptionSelect,
        clearVoiceNavigation,
        cancelRecording,
    };
};
