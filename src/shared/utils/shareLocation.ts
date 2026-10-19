import { Clipboard, Linking, Platform, Share } from 'react-native';
import { generateLocationUrl, type SharedLocation } from './deepLinking';
import {
    shareService,
    type ShareKind,
    type SharePoint,
    type ShareRouteExtras,
    type ShareRouteMode,
} from '../services/share.service';
import { showToast } from './toast';

export const buildLocationShareMessage = (location: SharedLocation, url = generateLocationUrl(location)): string => {
    return location.name
        ? `Check out ${location.name} on Gebeta Maps: ${url}`
        : `Check out this location on Gebeta Maps: ${url}`;
};

// short /s/<code> link from the backend; falls back to the legacy ?lat=&lng= link
// when offline or the request fails, so sharing never blocks on the network.
// a failed route share falls back to a destination-only legacy link (a pin, not a route)
export const createShareUrl = async (
    location: SharedLocation,
    kind: ShareKind = 'place',
    extras: ShareRouteExtras = {}
): Promise<string> => {
    const { data } = await shareService.create(location, kind, extras);
    // if (!data?.url) console.warn('[share] falling back to legacy lat/lng link');
    return data?.url ?? generateLocationUrl(location);
};

const openShareSheet = async (
    { message, url, title, includeUrl }: { message: string; url: string; title: string; includeUrl: boolean }
): Promise<boolean> => {
    try {
        const result = await Share.share({
            message,
            ...(includeUrl ? { url } : {}),
            title,
        });
        return result.action === Share.sharedAction;
    } catch (error) {
        console.error('Share error:', error);
        try {
            Clipboard.setString(message);
            showToast('Copied: Link copied to clipboard');
        } catch {
            showToast('Error: Could not share location');
        }
        return false;
    }
};

interface ShareLocationOptions {
    message?: string;
    includeUrl?: boolean;
    kind?: ShareKind;
}

export const shareLocation = async (
    location: SharedLocation,
    { message, includeUrl = true, kind = 'place' }: ShareLocationOptions = {}
): Promise<boolean> => {
    const url = message && !includeUrl ? generateLocationUrl(location) : await createShareUrl(location, kind);
    return openShareSheet({
        message: message ?? buildLocationShareMessage(location, url),
        url,
        title: location.name || 'Shared Location',
        includeUrl,
    });
};

// origin is only sent for a custom start point; without it the opener routes from their own location
export const shareRoute = async (
    destination: SharedLocation,
    origin: SharePoint | null,
    waypoints: SharePoint[],
    mode: ShareRouteMode
): Promise<boolean> => {
    const url = await createShareUrl(destination, 'route', {
        ...(origin ? { origin } : {}),
        ...(waypoints.length ? { waypoints } : {}),
        mode,
    });
    const to = destination.name || 'this location';
    const from = origin?.name ? ` from ${origin.name}` : '';
    return openShareSheet({
        message: `Directions to ${to}${from} on Gebeta Maps: ${url}`,
        url,
        title: destination.name || 'Shared Route',
        includeUrl: true,
    });
};

export const openSmsComposer = (body: string, phone = ''): Promise<void> => {
    const separator = Platform.OS === 'ios' ? '&' : '?';
    return Linking.openURL(`sms:${phone}${separator}body=${encodeURIComponent(body)}`);
};

export const openDialer = (phone: string): Promise<void> => Linking.openURL(`tel:${phone}`);
