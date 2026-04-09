export interface SharedLocation {
    lat: number;
    lng: number;
    name?: string;
    city?: string;
    country?: string;
    type?: string;
}

export function parseLocationUrl(url: string): SharedLocation | null {
    try {
        const urlObj = new URL(url);
        const params = urlObj.searchParams;

        const lat = params.get('lat');
        const lng = params.get('lng');

        if (!lat || !lng) {
            return null;
        }

        return {
            lat: parseFloat(lat),
            lng: parseFloat(lng),
            name: params.get('name') || undefined,
            city: params.get('city') || undefined,
            country: params.get('country') || undefined,
            type: params.get('type') || undefined,
        };
    } catch (error) {
        console.error('Error parsing location URL:', error);
        return null;
    }
}


export function generateLocationUrl(location: SharedLocation): string {
    const baseUrl = 'https://maps.gebeta.app/';
    const params = new URLSearchParams();

    params.append('lat', location.lat.toString());
    params.append('lng', location.lng.toString());

    if (location.name) params.append('name', location.name);
    if (location.city) params.append('city', location.city);
    if (location.country) params.append('country', location.country);
    if (location.type) params.append('type', location.type);

    return `${baseUrl}?${params.toString()}`;
}

export function isGebetaMapsUrl(url: string): boolean {
    try {
        const urlObj = new URL(url);
        return (
            (urlObj.hostname === 'maps.gebeta.app' || urlObj.hostname === 'www.maps.gebeta.app') &&
            urlObj.searchParams.has('lat') &&
            urlObj.searchParams.has('lng')
        );
    } catch {
        return false;
    }
}
