import { useState, useRef, useEffect, useCallback } from 'react';
import { File } from 'expo-file-system';
import { useVoiceRecording } from './useVoiceRecording';
import { VoiceNavSocket, type VoiceNavEvent } from '../services/voice-nav-socket.service';
import { StreamingPcmPlayer } from '../utils/streamingPcmPlayer';
import { showToast } from '../../../shared/utils/toast';
import { generateSessionId } from '../../../shared/utils/session';
import type { GebetaMapRef } from '@gebeta/tiles-react-native';
import type { VoiceNavigationData, NavigationOption } from '../types/voice-navigation.types';
import type { GeocodingPlace } from '../types/navigation.types';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

const vlog = (...args: any[]) => console.log('voice nav', ...args);

interface UseVoiceNavigationProps {
    mapRef: React.RefObject<GebetaMapRef | null>;
    userLocation: { lat: number; lng: number } | null;
    language?: string;
    onDestinationFound?: (destination: GeocodingPlace) => void;
}

const toWsLanguage = (lang?: string): 'am' | 'en' =>
    lang?.toLowerCase().startsWith('en') ? 'en' : 'am';

const buildStreamUrl = (
    sessionId: string,
    language: 'am' | 'en',
    userLocation: { lat: number; lng: number } | null,
): string => {
    const host = API_URL.replace(/^https?:\/\//, '').replace(/\/+$/, '');
    const scheme = API_URL.startsWith('https') ? 'wss' : 'ws';
    const params = new URLSearchParams({ sessionId, language });
    if (userLocation) {
        params.set('originLat', String(userLocation.lat));
        params.set('originLng', String(userLocation.lng));
    }
    return `${scheme}://${host}/voice-nav/stream?${params.toString()}`;
};

const toGeocodingPlace = (dest: any): GeocodingPlace | null => {
    const lat = Number(dest?.latitude ?? dest?.lat);
    const lng = Number(dest?.longitude ?? dest?.lng);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;

    return {
        id: 'voice-destination',
        name: dest.name,
        display_name: dest.name,
        category: dest.type || 'place',
        location: { lat, lng },
        address: {
            city: dest.City || '',
            country: dest.Country || '',
            country_code: '',
        },
        latitude: lat,
        longitude: lng,
        Country: dest.Country || '',
        City: dest.City || '',
        type: dest.type || 'place',
    };
};

export const useVoiceNavigation = ({
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

    const socketRef = useRef<VoiceNavSocket | null>(null);
    const playerRef = useRef<StreamingPcmPlayer | null>(null);
    const sessionIdRef = useRef<string>(generateSessionId());
    const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const recordingStartTime = useRef<number | null>(null);

    const reqStartRef = useRef<number | null>(null);
    const streamUrlRef = useRef<string>('');
    const ttsStatsRef = useRef<{ chunks: number; bytes: number; startedAt: number }>({ chunks: 0, bytes: 0, startedAt: 0 });
    const sinceReq = () => (reqStartRef.current ? `+${Date.now() - reqStartRef.current}ms` : '');

    const userLocationRef = useRef(userLocation);
    userLocationRef.current = userLocation;
    const onDestinationFoundRef = useRef(onDestinationFound);
    onDestinationFoundRef.current = onDestinationFound;
    const wsLanguageRef = useRef<'am' | 'en'>(toWsLanguage(language));
    wsLanguageRef.current = toWsLanguage(language);


    const finishProcessing = useCallback(() => {
        setIsProcessing(false);
    }, [setIsProcessing]);

    const handleDestination = useCallback((dest: any, routeToast?: { distanceKm: string; durationMin: number }) => {
        const place = toGeocodingPlace(dest);
        if (!place) {
            showToast.error('Invalid location', 'Could not get coordinates for this place');
            return;
        }
        setOptions([]);
        setShowOptions(false);
        setShowVoiceModal(false);
        setTranscription('');
        onDestinationFoundRef.current?.(place);
        if (routeToast) {
            showToast.success('Route Found', `${routeToast.distanceKm} km • ${routeToast.durationMin} min`);
        }
    }, []);

    const handleEvent = useCallback((event: VoiceNavEvent) => {
        const { type, data } = event;
        vlog(`event «${type}» ${sinceReq()}`, data ? JSON.stringify(data).slice(0, 300) : '');

        switch (type) {
            case 'connected': {
                const loc = userLocationRef.current;
                if (loc && socketRef.current?.isOpen) {
                    vlog('→ update_origin (on connect)', loc);
                    socketRef.current.sendJson('update_origin', { originLat: loc.lat, originLng: loc.lng });
                }
                break;
            }

            case 'processing':
                setIsProcessing(true);
                setTranscription('');
                break;

            case 'transcribed':
                vlog(`transcription: "${data?.text ?? ''}"`);
                if (data?.text) {
                    setTranscription(data.text);
                    showToast.success('Understood', data.text);
                }
                break;

            case 'intent':
                vlog('intent:', data?.intent, 'entities:', JSON.stringify(data?.entities));
                break;

            case 'geocoding':
                vlog(`geocoding ${data?.role ?? ''}: "${data?.query ?? ''}"`);
                break;

            case 'geocoded':
                vlog(`geocoded ${data?.role ?? ''}:`, data?.place?.name ?? data?.place);
                break;

            case 'routing':
                vlog('routing…');
                break;

            case 'speak':

                vlog(`speak (about to stream): "${data?.message ?? ''}"`);
                break;

            case 'disambiguate': {
                const opts: NavigationOption[] = data?.options ?? [];
                vlog(`disambiguate: ${opts.length} option(s)`, opts.map((o) => o.name));

                if (opts.length > 0) setOptions(opts);
                setShowOptions(true);
                setShowVoiceModal(false);
                finishProcessing();
                break;
            }

            case 'route': {
                const summary = data?.route?.trip?.legs?.[0]?.summary;
                const distanceKm = summary?.length?.toFixed(2) ?? '0';
                const durationMin = Math.round((summary?.time ?? 0) / 60);
                vlog(`route: → "${data?.destination?.name}" ${distanceKm}km ${durationMin}min`);
                setNavigationData({
                    origin: data?.origin ?? null,
                    destination: data?.destination ?? null,
                    route: data?.route ? { trip: data.route.trip ?? data.route } : null,
                });
                handleDestination(data?.destination, { distanceKm, durationMin });
                finishProcessing();
                break;
            }

            case 'navigation_ready':
            case 'destination_only':
                vlog(`${type}: → "${data?.destination?.name}"`);
                if (data?.destination) handleDestination(data.destination);
                finishProcessing();
                break;

            case 'awaiting_destination':
            case 'awaiting_confirmation':
                vlog(`${type}: "${data?.message ?? ''}"`);
                finishProcessing();
                break;

            case 'busy':
                vlog('busy:', data?.message);
                showToast.info('Please wait', data?.message ?? 'Still processing previous command');
                break;

            case 'ready':
                vlog(`ready ${sinceReq()} — request complete`);
                finishProcessing();
                break;

            case 'error':
                vlog('ERROR event:', data?.message, data?.detail ?? '');
                showToast.error('Something went wrong', data?.message ?? 'Please try again');
                finishProcessing();
                break;

            // ── TTS streaming ───────────────────────────────────────────────────
            case 'tts_start':
                ttsStatsRef.current = { chunks: 0, bytes: 0, startedAt: Date.now() };
                vlog(`tts_start ${sinceReq()} — message: "${data?.message ?? ''}"`);
                playerRef.current?.start();
                break;

            case 'tts_done': {
                const s = ttsStatsRef.current;
                const dur = s.startedAt ? Date.now() - s.startedAt : 0;
                vlog(`tts_done — received ${s.chunks} chunk(s), ${s.bytes} bytes over ${dur}ms`);
                if (s.chunks === 0) vlog('⚠️ tts_done with ZERO chunks — backend produced no audio');
                // All chunks are *sent*, but most are still queued & playing —
                // drain them instead of clearing, or the tail gets cut off.
                playerRef.current?.finish();
                break;
            }

            case 'tts_error': {
                const s = ttsStatsRef.current;
                vlog(`tts_error after ${s.chunks} chunk(s):`, data?.message);
                playerRef.current?.stop();
                break;
            }

            case 'origin_updated':
                vlog('origin_updated:', data);
                break;

            case 'language_updated':
                vlog('language_updated:', data);
                break;

            default:
                vlog('⚠️ unhandled event type:', type);
                break;
        }
    }, [finishProcessing, handleDestination, setIsProcessing]);


    useEffect(() => {
        if (!API_URL) {
            console.warn('voicenav: api url not set ');
            return;
        }

        playerRef.current = new StreamingPcmPlayer();
        let disposed = false;

        const connect = () => {
            if (disposed) return;
            const url = buildStreamUrl(sessionIdRef.current, wsLanguageRef.current, userLocationRef.current);
            streamUrlRef.current = url;
            vlog('connecting →', url);
            const socket = new VoiceNavSocket({
                onEvent: handleEvent,
                onPcm: (chunk) => {
                    const s = ttsStatsRef.current;
                    s.chunks += 1;
                    s.bytes += chunk.length;
                    if (s.chunks === 1 || s.chunks % 10 === 0) {
                        vlog(`tts_chunk #${s.chunks} (${chunk.length}B, total ${s.bytes}B) ${sinceReq()}`);
                    }
                    playerRef.current?.push(chunk);
                },
                onClose: () => {
                    socketRef.current = null;
                    playerRef.current?.stop();
                    if (!disposed) {
                        vlog('socket closed — reconnecting in 2s');
                        reconnectTimer.current = setTimeout(connect, 2000);
                    }
                },
                onError: () => {
                },
            });
            socketRef.current = socket;
            socket.connect(url);
        };

        connect();

        return () => {
            disposed = true;
            if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
            socketRef.current?.close();
            socketRef.current = null;
            playerRef.current?.dispose();
            playerRef.current = null;
        };
    }, [handleEvent]);

    useEffect(() => {
        if (userLocation && socketRef.current?.isOpen) {
            vlog('→ update_origin', userLocation);
            socketRef.current.sendJson('update_origin', {
                originLat: userLocation.lat,
                originLng: userLocation.lng,
            });
        }

    }, [userLocation?.lat, userLocation?.lng]);

    useEffect(() => {
        if (socketRef.current?.isOpen) {
            vlog('→ set_language', toWsLanguage(language));
            socketRef.current.sendJson('set_language', { language: toWsLanguage(language) });
        }
    }, [language]);


    const handleVoicePress = useCallback(() => {
        vlog('mic modal opened');
        setShowVoiceModal(true);
    }, []);

    const handleVoiceStart = useCallback(async () => {
        if (isRecording || isProcessing) {
            vlog('record start ignored (recording or processing already)');
            return;
        }

        recordingStartTime.current = Date.now();
        vlog('recording started');
        const started = await startRecording();
        if (!started) {
            vlog('recording failed to start');
            showToast.error('Recording Error', 'Failed to start recording');
            recordingStartTime.current = null;
        }
    }, [isRecording, isProcessing, startRecording]);

    const handleVoiceStop = useCallback(async () => {
        if (!recordingStartTime.current || !isRecording) return;
        const heldMs = Date.now() - recordingStartTime.current;
        recordingStartTime.current = null;

        const audioUri = await stopRecording();
        vlog(`recording stopped (held ${heldMs}ms) uri:`, audioUri);
        if (!audioUri) return;

        const socket = socketRef.current;
        if (!socket?.isOpen) {
            vlog('cannot send — socket not open');
            showToast.error('Connection lost', 'reconnecting');
            return;
        }

        try {
            setIsProcessing(true);
            const bytes = await new File(audioUri).bytes();
            reqStartRef.current = Date.now(); 
            vlog(`aud: post audio ${bytes.length} bytes → ${streamUrlRef.current} (socket open: ${socket.isOpen})`);
            socket.sendAudio(bytes, 'audio/mp4');
        } catch (error) {
            vlog('failed to read/send audio:', String(error));
            showToast.error('Something went wrong', 'Please try again');
            setIsProcessing(false);
        }
    }, [isRecording, stopRecording, setIsProcessing]);

    const handleCloseVoiceModal = useCallback(() => {
        vlog('mic modal closed');
        setShowVoiceModal(false);
        if (isRecording) cancelRecording();
    }, [isRecording, cancelRecording]);

    const clearVoiceNavigation = useCallback(() => {
        vlog('clear voice navigation');
        setNavigationData(null);
        setOptions([]);
        setShowOptions(false);
        setTranscription('');
    }, []);

    const handleOptionSelect = useCallback((optionId: number) => {
        const socket = socketRef.current;
        if (!socket?.isOpen) {
            vlog('cannot select option — socket not open');
            showToast.error('Connection lost', 'Please try again');
            return;
        }
        const selected = options.find((opt) => opt.id === optionId);
        reqStartRef.current = Date.now();
        vlog(`aud: select_option #${optionId} "${selected?.name ?? ''}" → ${streamUrlRef.current}`);
        setShowOptions(false);
        setIsProcessing(true);
        socket.sendJson('select_option', {
            optionId,
            ...(selected?.name ? { name: selected.name } : {}),
        });
    }, [options, setIsProcessing]);

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
