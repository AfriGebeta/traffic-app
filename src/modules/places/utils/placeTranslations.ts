import { PlaceType } from '../types/place.types';

export const getPlaceTranslationKey = (type: PlaceType): string => {
    const translationMap: Record<PlaceType, string> = {
        gas_station: 'gas-station',
        taxi_station: 'taxi-station',
        repair_shop: 'repair-shop',
        restaurant: 'restaurants',
        parking: 'parking',
        hospital: 'hospital',
        other: 'other',
    };

    return translationMap[type] || 'other';
};
