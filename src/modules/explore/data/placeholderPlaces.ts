import type { ImageSourcePropType } from 'react-native';
import type { GeocodingPlace } from '../../navigation/types/navigation.types';
import type { ExploreCategoryId } from '../types/explore.types';

export type PlaceholderPlace = GeocodingPlace & { imageSource: ImageSourcePropType };

const makePlace = (
    id: string,
    name: string,
    category: string,
    imageSource: ImageSourcePropType,
): PlaceholderPlace => ({
    id,
    name,
    display_name: name,
    category,
    location: { lat: 9.0192, lng: 38.7525 },
    address: { city: 'Addis Ababa', country: 'Ethiopia', country_code: 'ET' },
    latitude: 9.0192,
    longitude: 38.7525,
    Country: 'Ethiopia',
    City: 'Addis Ababa',
    type: category,
    imageSource,
});

export const PLACEHOLDER_PLACES: Partial<Record<ExploreCategoryId, PlaceholderPlace[]>> = {
    museum: [
        makePlace('ph-museum-1', 'National Museum', 'museum', require('../../../../assets/images/explore-museum-placeholder.jpeg')),
        makePlace('ph-museum-2', 'Ethnological Museum', 'museum', require('../../../../assets/images/explore-museum-placeholder-2.jpeg')),
    ],
    hotel: [
        makePlace('ph-hotel-1', 'Skylight Hotel', 'hotel', require('../../../../assets/images/explore-hotel-placeholder.jpeg')),
        makePlace('ph-hotel-2', 'Hyatt Regency', 'hotel', require('../../../../assets/images/explore-hotel-placeholder-2.jpeg')),
    ],
    park: [
        makePlace('ph-park-1', 'Unity Park', 'park', require('../../../../assets/images/explore-park-placeholder.jpeg')),
        makePlace('ph-park-2', 'Friendship Park', 'park', require('../../../../assets/images/explore-park-placeholder-2.jpeg')),
    ],
};
