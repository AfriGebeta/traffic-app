import { BoundingBox } from '../types/neighborhood.types';

/**
 * @param lat 
 * @param lng 
 * @param radiusDegrees
 */
export const calculateBoundingBox = (
    lat: number,
    lng: number,
    radiusDegrees: number = 0.02
): BoundingBox => {
    return {
        north: lat + radiusDegrees,
        south: lat - radiusDegrees,
        east: lng + radiusDegrees,
        west: lng - radiusDegrees,
    };
};

export const isWithinBoundingBox = (
    lat: number,
    lng: number,
    boundingBox: BoundingBox
): boolean => {
    return (
        lat >= boundingBox.south &&
        lat <= boundingBox.north &&
        lng >= boundingBox.west &&
        lng <= boundingBox.east
    );
};

export const getBoundingBoxCenter = (boundingBox: BoundingBox): { lat: number; lng: number } => {
    return {
        lat: (boundingBox.north + boundingBox.south) / 2,
        lng: (boundingBox.east + boundingBox.west) / 2,
    };
};

export const validateBoundingBox = (boundingBox: BoundingBox): {
    valid: boolean;
    error?: string;
} => {
    if (boundingBox.north <= boundingBox.south) {
        return { valid: false, error: 'north must be greater than south' };
    }
    if (boundingBox.east <= boundingBox.west) {
        return { valid: false, error: 'east must be greater than west' };
    }
    if (
        boundingBox.north < -90 || boundingBox.north > 90 ||
        boundingBox.south < -90 || boundingBox.south > 90
    ) {
        return { valid: false, error: 'latitude must be between -90 and 90' };
    }
    if (
        boundingBox.east < -180 || boundingBox.east > 180 ||
        boundingBox.west < -180 || boundingBox.west > 180
    ) {
        return { valid: false, error: 'longitude must be between -180 and 180' };
    }
    return { valid: true };
};
