import { useState, useRef, useEffect, useCallback } from 'react';
import { File } from 'expo-file-system';
import { useVoiceRecording } from './useVoiceRecording';
import { VoiceNavSocket, type VoiceNavEvent } from '../services/voice-nav-socket.service';
import { StreamingPcmPlayer } from '../utils/streamingPcmPlayer';
import { navigationService } from '../services/navigation.service';
import { showToast } from '../../../shared/utils/toast';
import { generateSessionId } from '../../../shared/utils/session';
import { dashboardEventsService } from '../../../shared/services/dashboard-events.service';
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
    const lat = Number(dest?.latitude ?? dest?.lat ?? dest?.location?.lat);
    const lng = Number(dest?.longitude ?? dest?.lng ?? dest?.location?.lng);
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
        meteringLevel,
        startRecording,
        stopRecording,
        cancelRecording,
    } = useVoiceRecording();

    const [navigationData, setNavigationData] = useState<VoiceNavigationData | null>(null);
    const [options, setOptions] = useState<NavigationOption[]>([]);
    const [currentOption, setCurrentOption] = useState<NavigationOption | null>(null);
    const [showOptions, setShowOptions] = useState(false);
    const [disambiguationMessage, setDisambiguationMessage] = useState<string>('');
    const [showVoiceModal, setShowVoiceModal] = useState(false);
    const [transcription, setTranscription] = useState<string>('');
    const [assistantMessage, setAssistantMessage] = useState<string>('');
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [canReplay, setCanReplay] = useState(false);

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

    const handleDestination = useCallback((dest: any) => {
        const place = toGeocodingPlace(dest);
        if (!place) {
            showToast.error('Invalid location', 'Could not get coordinates for this place');
            return;
        }
        setOptions([]);
        setCurrentOption(null);
        setShowOptions(false);
        setDisambiguationMessage('');
        setShowVoiceModal(false);
        setTranscription('');
        onDestinationFoundRef.current?.(place);
    }, []);

    const handleEvent = useCallback((event: VoiceNavEvent) => {
        const { type, data } = event;
        if (type !== 'pong') {
            vlog(`event «${type}» ${sinceReq()}`, data ? JSON.stringify(data).slice(0, 300) : '');
        }

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
                setAssistantMessage('');
                setCanReplay(false);
                playerRef.current?.stopPlayback();
                setIsSpeaking(false);
                break;

            case 'transcribed':
                vlog(`transcription: "${data?.text ?? ''}"`);
                if (data?.text) {
                    setTranscription(data.text);
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
                if (data?.message) setAssistantMessage(data.message);
                break;

            case 'disambiguate': {
                const opts: NavigationOption[] = data?.options ?? [];
                const current: NavigationOption | null = data?.current ?? null;

                if (data?.requiresConfirmation && opts.length === 0 && current) {
                    vlog(`disambiguate: auto-confirm "${current.name}"`);
                    const socket = socketRef.current;
                    if (socket?.isOpen) {
                        reqStartRef.current = Date.now();
                        socket.sendJson('select_option', { optionId: current.id, name: current.name });
                    }
                    break;
                }

                vlog(`disambiguate: ${opts.length} option(s)`, opts.map((o) => o.name));
                setOptions(opts);
                setCurrentOption(current);
                if (data?.message) setDisambiguationMessage(data.message);
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
                handleDestination(data?.destination);
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
                setCanReplay(false);
                setIsSpeaking(true);
                playerRef.current?.start();
                break;

            case 'tts_done': {
                const s = ttsStatsRef.current;
                const dur = s.startedAt ? Date.now() - s.startedAt : 0;
                vlog(`tts_done — received ${s.chunks} chunk(s), ${s.bytes} bytes over ${dur}ms`);
                if (s.chunks === 0) vlog('tts_done with ZERO chunks — backend produced no audio');
                playerRef.current?.finish();
                if (s.chunks > 0) setCanReplay(true);
                else setIsSpeaking(false);
                break;
            }

            case 'tts_error': {
                const s = ttsStatsRef.current;
                vlog(`tts_error after ${s.chunks} chunk(s):`, data?.message);
                playerRef.current?.stop();
                setIsSpeaking(false);
                setCanReplay(false);
                break;
            }

            case 'pong':
                break;

            case 'origin_updated':
                vlog('origin_updated:', data);
                break;

            case 'language_updated':
                vlog('language_updated:', data);
                break;

            default:
                vlog('unhandled event type:', type);
                break;
        }
    }, [finishProcessing, handleDestination, setIsProcessing]);


    useEffect(() => {
        if (!API_URL) {
            console.warn('voicenav: api url not set ');
            return;
        }

        playerRef.current = new StreamingPcmPlayer(() => setIsSpeaking(false));
        let disposed = false;
        let reconnectAttempt = 0;

        const scheduleReconnect = () => {
            if (disposed) return;
            if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
            const backoff = Math.min(30_000, 1_000 * 2 ** reconnectAttempt);
            const delay = backoff / 2 + Math.random() * (backoff / 2);
            reconnectAttempt += 1;
            vlog(`socket closed — reconnecting in ${Math.round(delay)}ms (attempt ${reconnectAttempt})`);
            reconnectTimer.current = setTimeout(connect, delay);
        };

        const connect = () => {
            if (disposed) return;
            if (socketRef.current?.isOpen) return;
            socketRef.current?.close();

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
                onOpen: () => {
                    reconnectAttempt = 0;
                },
                onClose: () => {
                    if (socketRef.current === socket) socketRef.current = null;
                    playerRef.current?.stopPlayback();
                    setIsSpeaking(false);
                    scheduleReconnect();
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

        playerRef.current?.stopPlayback();
        setIsSpeaking(false);

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
        setAssistantMessage('');
        playerRef.current?.stopPlayback();
        setIsSpeaking(false);
        setCanReplay(false);
    }, []);

    const replayResponse = useCallback(() => {
        if (!playerRef.current?.canReplay) return;
        vlog('replay response');
        setIsSpeaking(true);
        playerRef.current.replay();
    }, []);

    const handleOptionSelect = useCallback(async (optionId: number) => {
        const selected = options.find((opt) => opt.id === optionId);
        if (!selected) return;

        playerRef.current?.stopPlayback();
        setIsSpeaking(false);
        setShowOptions(false);
        setIsProcessing(true);

        const query = selected.name.split('|')[0].trim() || selected.name;
        vlog(`option tap #${optionId} "${query}" → geocoding`);

        const failed = (msg: string) => {
            vlog(`option geocode: ${msg}`);
            showToast.error('Something went wrong', 'Could not locate this place');
            setIsProcessing(false);
            setShowOptions(true);
        };

        try {
            const results = await navigationService.geocodePlace(query);
            const place = results.find(
                (p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude),
            );
            if (!place) {
                failed('no result with valid coordinates');
                return;
            }
            vlog(`option geocoded → "${place.name}" ${place.latitude},${place.longitude}`);
            handleDestination(place);
        } catch (err) {
            failed(`error ${String(err)}`);
        }
    }, [options, setIsProcessing, handleDestination]);

    return {
        isRecording,
        isProcessingVoice: isProcessing,
        navigationData,
        options,
        currentOption,
        showOptions,
        disambiguationMessage,
        showVoiceModal,
        transcription,
        assistantMessage,
        meteringLevel,
        isSpeaking,
        canReplay,
        handleVoicePress,
        handleVoiceStart,
        handleVoiceStop,
        handleCloseVoiceModal,
        handleOptionSelect,
        clearVoiceNavigation,
        replayResponse,
        cancelRecording,
    };
};
