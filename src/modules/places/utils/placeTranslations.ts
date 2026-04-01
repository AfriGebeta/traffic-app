import { PlaceType } from '../types/place.types';

export const getPlaceTranslationKey = (type: PlaceType): string => {
    const translationMap: Record<PlaceType, string> = {
        gas_station: 'gas-station',
        taxi_station: 'taxi-station',
        restaurant: 'restaurants',
        parking: 'parking',
        hospital: 'hospital',
        building: 'building',
        company: 'company',
        government: 'government-office',
        mall: 'mall',
        shop: 'shop',
        other: 'other',
    };

    return translationMap[type] || 'other';
};
