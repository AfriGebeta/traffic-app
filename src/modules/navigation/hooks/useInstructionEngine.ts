import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';

import type { Leg } from '../types/navigation.types';
import { ttsService } from '../services/tts.service';
import {
    allCueTexts,
    buildInstructionPlan,
    nextVoiceCue,
    resolveInstructionState,
    type InstructionPlan,
    type InstructionState,
    type VoiceCue,
} from '../utils/instructionEngine';

interface QueuedCue {
    tier: VoiceCue['tier'];
    text: string;
    queuedAt: number;
}

const CUE_MAX_AGE_MS = 10000;
const FINAL_CUE_MAX_AGE_MS = 20000;

interface Params {
    legs?: Leg[] | null;
    userLocation?: { lat: number; lng: number } | null;
    speedKmh?: number;
    isNavigating?: boolean;
    voiceEnabled?: boolean;
    voiceLeadDistanceM?: number;
}

export interface InstructionEngineResult {
    plan: InstructionPlan | null;
    state: InstructionState | null;
    lastCue: VoiceCue | null;
    prefetch: { done: number; total: number };
}

export const useInstructionEngine = ({
    legs,
    userLocation,
    speedKmh = 0,
    isNavigating = true,
    voiceEnabled = true,
    voiceLeadDistanceM,
}: Params): InstructionEngineResult => {
    const [state, setState] = useState<InstructionState | null>(null);
    const [lastCue, setLastCue] = useState<VoiceCue | null>(null);
    const [prefetch, setPrefetch] = useState({ done: 0, total: 0 });

    const speed = Math.max(0, speedKmh) / 3.6;

    const voiceOptions = useMemo(
        () => ({ leadDistanceM: voiceLeadDistanceM }),
        [voiceLeadDistanceM],
    );

    const alongRef = useRef(0);
    const firedRef = useRef<Set<string>>(new Set());
    const speakingRef = useRef(false);
    const soundRef = useRef<Audio.Sound | null>(null);
    const queueRef = useRef<QueuedCue[]>([]);
    const playingTierRef = useRef<VoiceCue['tier'] | null>(null);
    const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const drainRef = useRef<() => void>(() => { });
    const stopPlaybackRef = useRef<() => void>(() => { });
    const audioRef = useRef<Map<string, string>>(new Map());
    const generationRef = useRef(0);

    const plan = useMemo(() => buildInstructionPlan(legs), [legs]);
    useEffect(() => {
        alongRef.current = 0;
        firedRef.current = new Set();
        audioRef.current = new Map();
        queueRef.current = [];
        stopPlaybackRef.current();
        setLastCue(null);
        setState(null);
        setPrefetch({ done: 0, total: 0 });

        generationRef.current += 1;
        const generation = generationRef.current;
        if (!plan) return;
        const texts = allCueTexts(plan);
        setPrefetch({ done: 0, total: texts.length });

        (async () => {
            for (const text of texts) {
                if (generationRef.current !== generation) return;
                if (audioRef.current.has(text)) continue;
                try {
                    const uri = await ttsService.synthesizeSpeech(text);
                    if (generationRef.current !== generation) return;
                    if (uri) audioRef.current.set(text, uri);
                } catch {
                }
                setPrefetch((p) => ({ ...p, done: audioRef.current.size }));
            }
        })();
    }, [plan]);

    const finishPlayback = useCallback(() => {
        speakingRef.current = false;
        playingTierRef.current = null;
        if (watchdogRef.current) {
            clearTimeout(watchdogRef.current);
            watchdogRef.current = null;
        }
        drainRef.current();
    }, []);

    const playCue = useCallback(async (cue: QueuedCue) => {
        speakingRef.current = true;
        playingTierRef.current = cue.tier;
        try {
            const uri = audioRef.current.get(cue.text) ?? (await ttsService.synthesizeSpeech(cue.text));
            if (!uri) {
                finishPlayback();
                return;
            }
            audioRef.current.set(cue.text, uri);

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
                playsInSilentModeIOS: true,
                staysActiveInBackground: true,
                shouldDuckAndroid: true,
                interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
                interruptionModeIOS: InterruptionModeIOS.DuckOthers,
                playThroughEarpieceAndroid: false,
            });

            const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true, volume: 1.0 });
            soundRef.current = sound;
            sound.setOnPlaybackStatusUpdate((status) => {
                if (status.isLoaded && status.didJustFinish) {
                    soundRef.current = null;
                    void sound.unloadAsync().catch(() => { });
                    finishPlayback();
                }
            });

            watchdogRef.current = setTimeout(finishPlayback, 15000);
        } catch {
            finishPlayback();
        }
    }, [finishPlayback]);

    const drain = useCallback(() => {
        if (speakingRef.current) return;
        while (queueRef.current.length > 0) {
            const cue = queueRef.current.shift()!;
            const maxAge = cue.tier === 'final' ? FINAL_CUE_MAX_AGE_MS : CUE_MAX_AGE_MS;
            if (Date.now() - cue.queuedAt > maxAge) continue;
            void playCue(cue);
            return;
        }
    }, [playCue]);

    useEffect(() => { drainRef.current = drain; }, [drain]);

    const enqueue = useCallback((cue: VoiceCue) => {
        const queued: QueuedCue = { tier: cue.tier, text: cue.text, queuedAt: Date.now() };

        if (cue.tier === 'final') {
            queueRef.current = queueRef.current.filter((c) => c.tier === 'final');
            queueRef.current.push(queued);
            if (speakingRef.current && playingTierRef.current !== 'final') {
                const sound = soundRef.current;
                soundRef.current = null;
                void sound?.stopAsync().catch(() => { });
                void sound?.unloadAsync().catch(() => { });
                finishPlayback();
                return;
            }
        } else {
            queueRef.current.push(queued);
        }

        if (queueRef.current.length > 3) queueRef.current = queueRef.current.slice(-3);
        drain();
    }, [drain, finishPlayback]);

    const stopVoice = useCallback(() => {
        queueRef.current = [];
        const sound = soundRef.current;
        soundRef.current = null;
        void sound?.stopAsync().catch(() => { });
        void sound?.unloadAsync().catch(() => { });
        speakingRef.current = false;
        playingTierRef.current = null;
        if (watchdogRef.current) {
            clearTimeout(watchdogRef.current);
            watchdogRef.current = null;
        }
    }, []);

    useEffect(() => { stopPlaybackRef.current = stopVoice; }, [stopVoice]);

    useEffect(() => {
        if (!isNavigating) stopVoice();
    }, [isNavigating, stopVoice]);
    useEffect(() => () => {
        soundRef.current?.unloadAsync().catch(() => { });
        if (watchdogRef.current) clearTimeout(watchdogRef.current);
    }, []);

    useEffect(() => {
        if (!plan || !userLocation || !isNavigating) return;

        const next = resolveInstructionState(plan, userLocation, alongRef.current, { speedMps: speed });
        alongRef.current = next.alongDistance;
        setState(next);

        const cue = nextVoiceCue(plan, next, speed, firedRef.current, voiceOptions);
        if (cue) {
            firedRef.current.add(cue.key);
            cue.suppresses?.forEach((key) => firedRef.current.add(key));
            setLastCue(cue);
            if (voiceEnabled) enqueue(cue);
        }
    }, [plan, userLocation, speed, isNavigating, voiceEnabled, voiceOptions, enqueue]);

    return { plan, state, lastCue, prefetch };
};
