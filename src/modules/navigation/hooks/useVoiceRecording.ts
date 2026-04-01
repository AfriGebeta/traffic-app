import { useState, useRef } from 'react';
import { Audio } from 'expo-av';
import { showToast } from '../../../shared/utils/toast';

export const useVoiceRecording = () => {
    const [isRecording, setIsRecording] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const recordingRef = useRef<Audio.Recording | null>(null);

    const startRecording = async (): Promise<boolean> => {
        try {
            const { status } = await Audio.requestPermissionsAsync();
            if (status !== 'granted') {
                showToast.error('Permission Denied', 'Microphone permission is required');
                return false;
            }
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
                staysActiveInBackground: false,
                shouldDuckAndroid: true,
                playThroughEarpieceAndroid: false,
            });

            const recordingOptions = {
                android: {
                    extension: '.m4a',
                    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
                    audioEncoder: Audio.AndroidAudioEncoder.AAC,
                    sampleRate: 44100,
                    numberOfChannels: 1,
                    bitRate: 128000,
                },
                ios: {
                    extension: '.m4a',
                    outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
                    audioQuality: Audio.IOSAudioQuality.HIGH,
                    sampleRate: 44100,
                    numberOfChannels: 1,
                    bitRate: 128000,
                },
                web: {
                    mimeType: 'audio/webm',
                    bitsPerSecond: 128000,
                },
            };

            const { recording } = await Audio.Recording.createAsync(recordingOptions);

            recordingRef.current = recording;
            setIsRecording(true);
            return true;
        } catch (error) {
            console.error('Failed to start recording:', error);
            showToast.error('Recording Error', 'Could not start recording');
            return false;
        }
    };

    const stopRecording = async (): Promise<string | null> => {
        try {
            if (!recordingRef.current) {
                return null;
            }

            setIsRecording(false);

            const status = await recordingRef.current.getStatusAsync();
            const durationMillis = status.durationMillis || 0;

            if (durationMillis < 500) {
                showToast.error('Recording Too Short', 'Please speak for at least 1 second');
                await recordingRef.current.stopAndUnloadAsync();
                await Audio.setAudioModeAsync({
                    allowsRecordingIOS: false,
                });
                recordingRef.current = null;
                return null;
            }

            await recordingRef.current.stopAndUnloadAsync();
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
            });

            const uri = recordingRef.current.getURI();
            recordingRef.current = null;

            return uri;
        } catch (error) {
            console.error('Failed to stop recording:', error);
            showToast.error('Recording Error', 'Could not stop recording');
            return null;
        }
    };

    const cancelRecording = async () => {
        try {
            if (recordingRef.current) {
                setIsRecording(false);
                await recordingRef.current.stopAndUnloadAsync();
                await Audio.setAudioModeAsync({
                    allowsRecordingIOS: false,
                });
                recordingRef.current = null;
            }
        } catch (error) {
            console.error('Failed to cancel recording:', error);
        }
    };

    return {
        isRecording,
        isProcessing,
        setIsProcessing,
        startRecording,
        stopRecording,
        cancelRecording,
    };
};
