import React, {
    forwardRef,
    memo,
    useCallback,
    useEffect,
    useImperativeHandle,
    useMemo,
    useRef,
    useState,
} from 'react';
import { Image, PixelRatio, StyleSheet, View } from 'react-native';
import MapLibreGL from '@maplibre/maplibre-react-native';
import { getAppConfig } from '../../../shared/config/remoteConfigValues';
import {
    FREE_DRIVE_PITCH,
    FREE_DRIVE_ZOOM,
    PUCK_OVERLAY_SIZE,
    PUCK_SCREEN_FRACTION,
} from '../constants';
import { useRoadSnapper } from '../hooks/useRoadSnapper';
import { angleDelta, haversine } from '../utils/geo';
import { FreeDriveMotion, MotionFix, MotionSample } from '../utils/motionModel';
import { TravelDirection } from '../utils/travelDirection';

const PUCK_IMAGE = require('../../../../assets/images/Mappin.png');

const cameraPaddingTop = (mapHeight: number): number => {
    const desiredDp = (2 * PUCK_SCREEN_FRACTION - 1) * mapHeight;
    return Math.max(0, Math.round(desiredDp / PixelRatio.getFontScale()));
};

export interface FreeDriveTelemetry {
    speed: number;
    heading: number;
    roadName: string | null;
    snapped: boolean;
}

export interface FreeDriveMapHandle {
    recenter: () => void;
}

interface FreeDriveMapProps {
    styleJson?: Record<string, unknown>;
    styleUrl?: string;
    fix: MotionFix | null;
    snapEnabled?: boolean;
    onTelemetry?: (telemetry: FreeDriveTelemetry) => void;
    onCameraFreeChange?: (free: boolean) => void;
    nameLang?: string;
    initialCenter?: { lat: number; lng: number } | null;
}

const TELEMETRY_MS = 250;
const FOLLOW_GRACE_MS = 2500;

const RECENTER_GRACE_MS = 1500;
const GESTURE_ZOOM_EPSILON = 0.2;
const GESTURE_HEADING_DELTA = 20;
const GESTURE_PAN_METERS = 3;
const GESTURE_PAN_ZOOM_DELTA = 0.15;

const ANIMATED_CAMERA_SETTLE_MS = 1200;
const WAITING_ZOOM = 14;
const WAITING_PITCH = 0;
const FOLLOW_FLY_MS = 600;
const FOLLOW_FLY_HOLD_MS = FOLLOW_FLY_MS + 100;

const FreeDriveMapInner = forwardRef<FreeDriveMapHandle, FreeDriveMapProps>(({
    styleJson,
    styleUrl,
    fix,
    snapEnabled = true,
    onTelemetry,
    onCameraFreeChange,
    nameLang,
    initialCenter,
}, ref) => {
    const mapRef = useRef<any>(null);
    const cameraRef = useRef<any>(null);
    const puckSrcRef = useRef<any>(null);

    const motionRef = useRef(new FreeDriveMotion());
    const travelRef = useRef(new TravelDirection());
    const { snap, reset: resetSnapper } = useRoadSnapper(mapRef, nameLang);

    const [size, setSize] = useState({ width: 0, height: 0 });
    const sizeRef = useRef(size);
    sizeRef.current = size;
    const [cameraFree, setCameraFree] = useState(false);
    const cameraFreeRef = useRef(false);

    const [ready, setReady] = useState(false);
    const zoomAppliedRef = useRef(false);
    const snappedRef = useRef(false);
    const roadNameRef = useRef<string | null>(null);
    const unlockGraceUntilRef = useRef(Date.now() + FOLLOW_GRACE_MS);

    const flyResumeUntilRef = useRef(0);
    const lastRegionRef = useRef<
        { center: [number, number]; heading: number; zoom: number } | null
    >(null);
    const lastAnimatedCameraAtRef = useRef(0);
    const hasLockedOnRef = useRef(false);
    const lastSampleRef = useRef<{ lat: number; lng: number; heading: number } | null>(
        null
    );

    useEffect(() => () => {
        motionRef.current.reset();
        travelRef.current.reset();
        resetSnapper();
    }, [resetSnapper]);

    const setFree = useCallback((free: boolean) => {
        if (cameraFreeRef.current === free) return;
        cameraFreeRef.current = free;
        lastRegionRef.current = null;
        setCameraFree(free);
        onCameraFreeChange?.(free);
    }, [onCameraFreeChange]);

    useImperativeHandle(ref, () => ({
        recenter: () => {
            zoomAppliedRef.current = false;
            unlockGraceUntilRef.current = Date.now() + RECENTER_GRACE_MS;
            setFree(false);
        },
    }), [setFree]);
    const handleTouchStart = useCallback(() => {
        if (!hasLockedOnRef.current) return;
        if (Date.now() < unlockGraceUntilRef.current) return;
        setFree(true);
    }, [setFree]);
    const observeTouch = useCallback(() => {
        handleTouchStart();
        return false;
    }, [handleTouchStart]);
    const handleRegionIsChanging = useCallback((e: any) => {
        if (cameraFreeRef.current || !hasLockedOnRef.current) return;

        const now = Date.now();
        if (now < unlockGraceUntilRef.current) return;

        const props = e?.properties ?? {};
        const zoomLevel = props.zoomLevel ?? props.zoom;
        const heading = props.heading ?? 0;
        const coords = e?.geometry?.coordinates;
        if (zoomLevel === undefined || !Array.isArray(coords) || coords.length < 2) return;

        const current = {
            center: [coords[0], coords[1]] as [number, number],
            heading,
            zoom: zoomLevel,
        };

        if (Math.abs(zoomLevel - FREE_DRIVE_ZOOM) > GESTURE_ZOOM_EPSILON) {
            setFree(true);
            return;
        }
        if (now - lastAnimatedCameraAtRef.current < ANIMATED_CAMERA_SETTLE_MS) return;
        if (
            typeof props.heading === 'number' &&
            angleDelta(props.heading, motionRef.current.getRenderedHeading()) >
            GESTURE_HEADING_DELTA
        ) {
            setFree(true);
            return;
        }

        const prev = lastRegionRef.current;
        lastRegionRef.current = current;
        if (!prev) return;

        const drift = haversine(
            { lat: prev.center[1], lng: prev.center[0] },
            { lat: current.center[1], lng: current.center[0] }
        );
        if (
            drift > GESTURE_PAN_METERS &&
            Math.abs(zoomLevel - prev.zoom) < GESTURE_PAN_ZOOM_DELTA
        ) {
            setFree(true);
        }
    }, [setFree]);

    useEffect(() => {
        if (!fix) return;
        const motion = motionRef.current;
        const frame = motion.getFrame();
        const { width, height } = sizeRef.current;

        if (!snapEnabled || !frame || width === 0 || height === 0) {
            motion.onFix(fix);
            snappedRef.current = false;
            return;
        }

        const rawXY = frame.toXY(fix.lat, fix.lng);
        travelRef.current.push(rawXY, fix.t ?? Date.now());

        const { result, roadName } = snap({
            p: rawXY,
            frame,
            travelBearing: travelRef.current.get(),
            speed: motion.getSpeed(),
            screenPoint: [width / 2, height * PUCK_SCREEN_FRACTION],
        });

        roadNameRef.current = roadName;
        snappedRef.current = !!result;

        if (!result) {
            motion.onFix(fix);
            return;
        }

        const snappedLatLng = frame.toLatLng(result.foot.x, result.foot.y);
        motion.onFix({
            ...fix,
            lat: snappedLatLng.lat,
            lng: snappedLatLng.lng,
            roadBearing: result.bearing,
            road: {
                key: result.road.key,
                points: result.road.points,
                cum: result.road.cum,
                distanceAlong: result.distanceAlong,
                direction: result.reversed ? -1 : 1,
            },
        });
    }, [fix, snap, snapEnabled]);

    // --- render loop: one sample drives the puck and the camera together.
    useEffect(() => {
        if (!ready) return;

        let rafId: number;
        let lastTelemetry = 0;

        const tick = () => {
            const now = Date.now();
            const sample: MotionSample | null = motionRef.current.sample(now);

            if (sample) {
                lastSampleRef.current = {
                    lat: sample.lat,
                    lng: sample.lng,
                    heading: sample.heading,
                };

                puckSrcRef.current?.setNativeProps({
                    shape: JSON.stringify({
                        type: 'Feature',
                        properties: { heading: sample.heading },
                        geometry: { type: 'Point', coordinates: [sample.lng, sample.lat] },
                    }),
                });

                if (
                    !cameraFreeRef.current &&
                    cameraRef.current &&
                    now >= flyResumeUntilRef.current
                ) {
                    const height = sizeRef.current.height;
                    const locking = !zoomAppliedRef.current;
                    zoomAppliedRef.current = true;
                    if (locking) {
                        hasLockedOnRef.current = true;
                        unlockGraceUntilRef.current = now + FOLLOW_GRACE_MS;
                    }
                    if (locking) flyResumeUntilRef.current = now + FOLLOW_FLY_HOLD_MS;
                    if (locking) lastAnimatedCameraAtRef.current = now;

                    cameraRef.current.setCamera({
                        centerCoordinate: [sample.lng, sample.lat],
                        padding: { paddingTop: cameraPaddingTop(height) },
                        heading: sample.heading,
                        pitch: FREE_DRIVE_PITCH,
                        ...(locking
                            ? {
                                zoomLevel: FREE_DRIVE_ZOOM,
                                animationDuration: 600,
                                animationMode: 'flyTo' as const,
                            }
                            : {
                                animationDuration: 0,
                                animationMode: 'moveTo' as const,
                            }),
                    });
                }

                if (onTelemetry && now - lastTelemetry >= TELEMETRY_MS) {
                    lastTelemetry = now;
                    onTelemetry({
                        speed: sample.speed,
                        heading: sample.heading,
                        roadName: roadNameRef.current,
                        snapped: snappedRef.current,
                    });
                }
            }

            rafId = requestAnimationFrame(tick);
        };

        rafId = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafId);
    }, [ready, onTelemetry]);

    const initialPuckShape = useMemo(
        () => ({
            type: 'Feature' as const,
            properties: { heading: 0 },
            geometry: { type: 'Point' as const, coordinates: [0, 0] },
        }),
        []
    );

    const overlayStyle = useMemo(
        () => ({
            position: 'absolute' as const,
            left: size.width / 2 - PUCK_OVERLAY_SIZE / 2,
            top: size.height * PUCK_SCREEN_FRACTION - PUCK_OVERLAY_SIZE / 2,
            width: PUCK_OVERLAY_SIZE,
            height: PUCK_OVERLAY_SIZE,
        }),
        [size.width, size.height]
    );

    const openAt = lastSampleRef.current
        ? { center: [lastSampleRef.current.lng, lastSampleRef.current.lat], framed: true }
        : initialCenter
            ? { center: [initialCenter.lng, initialCenter.lat], framed: true }
            : {
                center: [
                    getAppConfig().defaultMapCenterLng,
                    getAppConfig().defaultMapCenterLat,
                ],
                framed: false,
            };

    const showOverlayPuck = !cameraFree && ready && motionRef.current.isStarted();

    return (
        <View
            style={StyleSheet.absoluteFill}
            onStartShouldSetResponderCapture={observeTouch}
            onMoveShouldSetResponderCapture={observeTouch}
            onLayout={(e) => {
                const { width, height } = e.nativeEvent.layout;
                setSize({ width, height });
            }}
        >
            <MapLibreGL.MapView
                ref={mapRef}
                style={StyleSheet.absoluteFill}
                mapStyle={styleJson ?? styleUrl}
                logoEnabled={false}
                attributionEnabled={false}
                compassEnabled={cameraFree}
                compassViewPosition={1}
                compassViewMargins={{ x: 16, y: 130 }}
                scrollEnabled
                zoomEnabled
                rotateEnabled
                pitchEnabled
                onDidFinishLoadingMap={() => setReady(true)}
                onRegionIsChanging={handleRegionIsChanging}
                {...({ onTouchStart: handleTouchStart } as Record<string, unknown>)}
            >
                {!cameraFree && (
                    <MapLibreGL.Camera
                        key="free-drive-follow-camera"
                        ref={cameraRef}
                        defaultSettings={{
                            centerCoordinate: openAt.center,
                            zoomLevel: openAt.framed ? FREE_DRIVE_ZOOM : WAITING_ZOOM,
                            pitch: openAt.framed ? FREE_DRIVE_PITCH : WAITING_PITCH,
                            heading: lastSampleRef.current?.heading ?? 0,
                        }}
                    />
                )}
                <MapLibreGL.Images images={{ freeDrivePuck: PUCK_IMAGE }} />

                <MapLibreGL.ShapeSource
                    ref={puckSrcRef}
                    id="free-drive-puck-source"
                    shape={initialPuckShape}
                >
                    <MapLibreGL.SymbolLayer
                        id="free-drive-puck-layer"
                        style={{
                            iconImage: 'freeDrivePuck',
                            iconSize: 1.1,
                            iconRotate: ['get', 'heading'],
                            iconRotationAlignment: 'map',
                            iconAllowOverlap: true,
                            iconIgnorePlacement: true,
                            iconAnchor: 'center',
                            iconOpacity: showOverlayPuck ? 0 : 1,
                        }}
                    />
                </MapLibreGL.ShapeSource>
            </MapLibreGL.MapView>

            {showOverlayPuck && (
                <View style={overlayStyle} pointerEvents="none">
                    <Image
                        source={PUCK_IMAGE}
                        style={styles.overlayPuckImage}
                        resizeMode="contain"
                    />
                </View>
            )}
        </View>
    );
});

const styles = StyleSheet.create({
    overlayPuckImage: { width: '100%', height: '100%' },
});

FreeDriveMapInner.displayName = 'FreeDriveMap';
const FreeDriveMap = memo(FreeDriveMapInner);

export default FreeDriveMap;
