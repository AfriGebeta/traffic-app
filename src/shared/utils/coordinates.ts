export const parseCoordinates = (query: string): { lat: number; lng: number } | null => {
    const cleaned = query.trim().replace(/\s+/g, ' ');

    const patterns = [
        /^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/,  //lat,lng
        /^(-?\d+\.?\d*)\s+(-?\d+\.?\d*)$/,  //lat lng
    ];

    for (const pattern of patterns) {
        const match = cleaned.match(pattern);
        if (match) {
            const lat = parseFloat(match[1]);
            const lng = parseFloat(match[2]);
            if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                return { lat, lng };
            }
        }
    }

    return null;
};
