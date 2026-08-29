import { PlaceType } from '../types/place.types';

export const getPlaceTranslationKey = (type: PlaceType): string => {
    const translationMap: Record<PlaceType, string> = {
        gas_station: 'gas-station',
        taxi_station: 'taxi-station',
        restaurant: 'restaurants',
        cafe: 'cafe',
        parking: 'parking',
        hospital: 'hospital',
        clinic: 'clinic',
        pharmacy: 'pharmacy',
        bank: 'bank',
        atm: 'atm',
        hotel: 'hotel',
        school: 'school',
        park: 'park',
        building: 'building',
        company: 'company',
        government: 'government-office',
        mall: 'mall',
        shop: 'shop',
        other: 'other',
    };

    return translationMap[type] || 'other';
};
