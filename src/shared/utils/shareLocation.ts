import { Clipboard, Linking, Platform, Share } from 'react-native';
import { generateLocationUrl, type SharedLocation } from './deepLinking';
import { showToast } from './toast';

export const buildLocationShareMessage = (location: SharedLocation): string => {
    const url = generateLocationUrl(location);
    return location.name
        ? `Check out ${location.name} on Gebeta Maps: ${url}`
        : `Check out this location on Gebeta Maps: ${url}`;
};

interface ShareLocationOptions {
    message?: string;
    includeUrl?: boolean;
}

export const shareLocation = async (
    location: SharedLocation,
    { message, includeUrl = true }: ShareLocationOptions = {}
): Promise<boolean> => {
    const url = generateLocationUrl(location);
    try {
        const result = await Share.share({
            message: message ?? buildLocationShareMessage(location),
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
