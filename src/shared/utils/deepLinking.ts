export interface SharedLocation {
    lat: number;
    lng: number;
    name?: string;
    city?: string;
    country?: string;
    type?: string;
}

const COORD_PAIR = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/;

function toLocation(lat: number, lng: number, name?: string): SharedLocation | null {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    if (lat === 0 && lng === 0) return null;
    return { lat, lng, name: name || undefined };
}

function parseCoordString(value: string): SharedLocation | null {
    const labelMatch = value.match(/^([^(]+)\((.*)\)\s*$/);
    const coords = labelMatch ? labelMatch[1] : value;
    const label = labelMatch ? decodeURIComponent(labelMatch[2]) : undefined;

    const match = coords.match(COORD_PAIR);
    if (!match) return null;

    return toLocation(parseFloat(match[1]), parseFloat(match[2]), label);
}

function splitOpaqueUri(url: string, scheme: string): { path: string; query: URLSearchParams } {
    const body = url.slice(scheme.length + 1);
    const queryIndex = body.indexOf('?');
    const path = queryIndex === -1 ? body : body.slice(0, queryIndex);
    const query = new URLSearchParams(queryIndex === -1 ? '' : body.slice(queryIndex + 1));
    return { path: decodeURIComponent(path), query };
}

function parseGeoUrl(url: string): SharedLocation | null {
    const { path, query } = splitOpaqueUri(url, 'geo');

    const q = query.get('q');
    if (q) {
        const fromQuery = parseCoordString(q);
        if (fromQuery) return fromQuery;
    }

    return parseCoordString(path);
}

function parseGoogleNavigationUrl(url: string): SharedLocation | null {
    const query = new URLSearchParams(url.slice('google.navigation:'.length));
    const q = query.get('q');
    return q ? parseCoordString(q) : null;
}

function parseGoogleMapsUrl(urlObj: URL): SharedLocation | null {
    const params = urlObj.searchParams;

    for (const key of ['query', 'destination', 'daddr', 'q']) {
        const value = params.get(key);
        if (value) {
            const parsed = parseCoordString(value);
            if (parsed) return parsed;
        }
    }

    const atMatch = urlObj.pathname.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
    if (atMatch) {
        const placeMatch = urlObj.pathname.match(/\/place\/([^/@]+)/);
        const name = placeMatch ? decodeURIComponent(placeMatch[1]).replace(/\+/g, ' ') : undefined;
        return toLocation(parseFloat(atMatch[1]), parseFloat(atMatch[2]), name);
    }

    const segments = urlObj.pathname.split('/').filter(Boolean);
    for (let i = segments.length - 1; i >= 0; i--) {
        const parsed = parseCoordString(decodeURIComponent(segments[i]));
        if (parsed) return parsed;
    }

    return null;
}

export function parseLocationUrl(url: string): SharedLocation | null {
    try {
        if (url.startsWith('geo:')) return parseGeoUrl(url);
        if (url.startsWith('google.navigation:')) return parseGoogleNavigationUrl(url);

        const urlObj = new URL(url);
        const params = urlObj.searchParams;

        const lat = params.get('lat');
        const lng = params.get('lng');

        if (!lat || !lng) {
            return isGoogleMapsHost(urlObj.hostname) ? parseGoogleMapsUrl(urlObj) : null;
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

function isGoogleMapsHost(hostname: string): boolean {
    const host = hostname.replace(/^www\./, '');
    return (
        host === 'maps.google.com' ||
        host === 'google.com' ||
        host === 'maps.app.goo.gl' ||
        host === 'goo.gl' ||
        /^maps\.google\.[a-z.]+$/.test(host)
    );
}

const SHORT_LINK_HOSTS = ['maps.app.goo.gl', 'goo.gl'];

function isShortLink(url: string): boolean {
    try {
        return SHORT_LINK_HOSTS.includes(new URL(url).hostname.replace(/^www\./, ''));
    } catch {
        return false;
    }
}

export async function resolveLocationUrl(
    url: string,
    timeoutMs = 6000
): Promise<SharedLocation | null> {
    const direct = parseLocationUrl(url);
    if (direct || !isShortLink(url)) return direct;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, { redirect: 'follow', signal: controller.signal });
        return parseLocationUrl(response.url || url);
    } catch (error) {
        console.error('Error resolving short location URL:', error);
        return null;
    } finally {
        clearTimeout(timer);
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

export function generateCustomSchemeUrl(location: SharedLocation): string {
    const baseUrl = 'trafficapp://';
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
            (urlObj.protocol === 'trafficapp:' ||
                urlObj.hostname === 'maps.gebeta.app' ||
                urlObj.hostname === 'www.maps.gebeta.app') &&
            urlObj.searchParams.has('lat') &&
            urlObj.searchParams.has('lng')
        );
    } catch {
        return false;
    }
}

export function isSupportedLocationUrl(url: string): boolean {
    if (url.startsWith('geo:') || url.startsWith('google.navigation:')) return true;
    if (isGebetaMapsUrl(url)) return true;
    if (isShortLink(url)) return true;
    try {
        return isGoogleMapsHost(new URL(url).hostname);
    } catch {
        return false;
    }
}
