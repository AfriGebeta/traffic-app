import { useEffect, useRef } from 'react';
import { voiceNavigationService } from '../services/voice-navigation.service';
import { getAppConfig } from '../../../shared/config/remoteConfigValues';

interface UseVoiceInstructionsProps {
    currentInstruction: string;
    isNavigating: boolean;
    enabled?: boolean;
}

export const useVoiceInstructions = ({
    currentInstruction,
    isNavigating,
    enabled = true,
}: UseVoiceInstructionsProps) => {
    const lastSpokenInstructionRef = useRef<string>('');
    const lastSpokenTimeRef = useRef<number>(0);
    const MIN_SPEAK_INTERVAL_MS = getAppConfig().voiceMinSpeakIntervalMs;

    useEffect(() => {
        if (!enabled || !isNavigating || !currentInstruction) {
            return;
        }

        if (currentInstruction === lastSpokenInstructionRef.current) {
            return;
        }

        const now = Date.now();
        if (now - lastSpokenTimeRef.current < MIN_SPEAK_INTERVAL_MS) {
            return;
        }

        lastSpokenInstructionRef.current = currentInstruction;
        lastSpokenTimeRef.current = now;

        voiceNavigationService.speakInstruction(currentInstruction).catch((error) => {
            console.error('Failed to speak instruction:', error);
        });
    }, [currentInstruction, isNavigating, enabled]);

    return {
        lastSpokenInstruction: lastSpokenInstructionRef.current,
    };
};
