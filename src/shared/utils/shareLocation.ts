import { Clipboard, Linking, Platform, Share } from 'react-native';
import { generateLocationUrl, type SharedLocation } from './deepLinking';
import { shareService, type ShareKind } from '../services/share.service';
import { showToast } from './toast';

export const buildLocationShareMessage = (location: SharedLocation, url = generateLocationUrl(location)): string => {
    return location.name
        ? `Check out ${location.name} on Gebeta Maps: ${url}`
        : `Check out this location on Gebeta Maps: ${url}`;
};

// short /s/<code> link from the backend; falls back to the legacy ?lat=&lng= link
// when offline or the request fails, so sharing never blocks on the network.
export const createShareUrl = async (location: SharedLocation, kind: ShareKind = 'place'): Promise<string> => {
    const { data } = await shareService.create(location, kind);
    // if (!data?.url) console.warn('[share] falling back to legacy lat/lng link');
    return data?.url ?? generateLocationUrl(location);
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
    try {
        const result = await Share.share({
            message: message ?? buildLocationShareMessage(location, url),
            ...(includeUrl ? { url } : {}),
            title: location.name || 'Shared Location',
        });
        return result.action === Share.sharedAction;
    } catch (error) {
        console.error('Share error:', error);
        try {
            Clipboard.setString(message ?? url);
            showToast('Copied: Link copied to clipboard');
        } catch {
            showToast('Error: Could not share location');
        }
        return false;
    }
};

export const openSmsComposer = (body: string, phone = ''): Promise<void> => {
    const separator = Platform.OS === 'ios' ? '&' : '?';
    return Linking.openURL(`sms:${phone}${separator}body=${encodeURIComponent(body)}`);
};

export const openDialer = (phone: string): Promise<void> => Linking.openURL(`tel:${phone}`);
