import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const NAV_MARKER_KEY = '@nav_marker';

export type NavMarkerId = 'puck' | 'car-white' | 'car-black' | 'car-blue' | 'car-brown' | 'car-red';

export interface NavMarkerOption {
    id: NavMarkerId;
    labelKey: string;
    swatch: string;
    image: any;
    mapImage: string;
    iconSize: number;
    overlayScale: number;
}

const PUCK_UNITS = 50 * 1.1;
const CAR_ICON_SIZE = 0.28;
const CAR_OVERLAY_SCALE = (192 * CAR_ICON_SIZE) / PUCK_UNITS;

const car = (id: NavMarkerId, labelKey: string, swatch: string, image: any): NavMarkerOption => ({
    id,
    labelKey,
    swatch,
    image,
    mapImage: `navMarker-${id}`,
    iconSize: CAR_ICON_SIZE,
    overlayScale: CAR_OVERLAY_SCALE,
});

export const NAV_MARKER_OPTIONS: NavMarkerOption[] = [
    {
        id: 'puck',
        labelKey: 'marker-classic-puck',
        swatch: '#4F8EF7',
        image: require('../../../../assets/images/Mappin.png'),
        mapImage: 'navPuck',
        iconSize: 1.1,
        overlayScale: 1,
    },
    car('car-white', 'marker-color-white', '#F5F5F5', require('../../../../assets/images/nav-car-white.png')),
    car('car-black', 'marker-color-black', '#1F2937', require('../../../../assets/images/nav-car-black.png')),
    car('car-blue', 'marker-color-blue', '#2563EB', require('../../../../assets/images/nav-car-blue.png')),
    car('car-brown', 'marker-color-brown', '#8B5A2B', require('../../../../assets/images/nav-car-brown.png')),
    car('car-red', 'marker-color-red', '#DC2626', require('../../../../assets/images/nav-car-red.png')),
];

export const DEFAULT_NAV_MARKER: NavMarkerId = 'puck';

export const NAV_MARKER_MAP_IMAGES: Record<string, any> = Object.fromEntries(
    NAV_MARKER_OPTIONS.map((option) => [option.mapImage, option.image]),
);

const optionById = (id: NavMarkerId): NavMarkerOption =>
    NAV_MARKER_OPTIONS.find((option) => option.id === id) ?? NAV_MARKER_OPTIONS[0];

let selected: NavMarkerOption = optionById(DEFAULT_NAV_MARKER);
const listeners = new Set<() => void>();
let loaded = false;
// set once the user picks, so a slow initial read can't overwrite the fresh choice
let changed = false;

const emit = () => listeners.forEach((listener) => listener());

const load = async () => {
    if (loaded) return;
    loaded = true;
    try {
        const stored = await AsyncStorage.getItem(NAV_MARKER_KEY);
        if (!changed && stored && NAV_MARKER_OPTIONS.some((option) => option.id === stored)) {
            selected = optionById(stored as NavMarkerId);
            emit();
        }
    } catch {
        // keep default
    }
};

const subscribe = (listener: () => void) => {
    listeners.add(listener);
    load();
    return () => {
        listeners.delete(listener);
    };
};

const getSnapshot = () => selected;

export const setNavMarker = async (id: NavMarkerId) => {
    loaded = true;
    changed = true;
    selected = optionById(id);
    emit();
    try {
        await AsyncStorage.setItem(NAV_MARKER_KEY, id);
    } catch {
        // selection still applies for this session
    }
};

export const useNavMarker = (): NavMarkerOption => useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
