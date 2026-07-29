import { resolveLocationUrl } from '../shared/utils/deepLinking';

export async function redirectSystemPath({
    path,
}: {
    path: string;
    initial: boolean;
}): Promise<string> {
    try {
        const location = await resolveLocationUrl(path);
        if (!location) return path;

        const params = new URLSearchParams();
        params.append('lat', location.lat.toString());
        params.append('lng', location.lng.toString());
        if (location.name) params.append('name', location.name);
        if (location.city) params.append('city', location.city);
        if (location.country) params.append('country', location.country);
        if (location.type) params.append('type', location.type);

        return `/?${params.toString()}`;
    } catch (error) {
        console.error('redirectSystemPath failed', error);
        return path;
    }
}
