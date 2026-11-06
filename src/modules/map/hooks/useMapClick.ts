import { useCallback } from 'react';
import * as Haptics from 'expo-haptics';
import i18n from '../../../shared/utils/localization/i18n';
import type { GeocodingPlace } from '../../navigation/types/navigation.types';
import { exploreService } from '../services/exploreService';

interface UseMapClickParams {
    navigationMode: boolean;
    onSelectPlace: (place: GeocodingPlace) => void;
    setSelectedDestination: (place: GeocodingPlace) => void;
    setSearchQuery: (query: string) => void;
    skipSearchRef: React.MutableRefObject<boolean>;
    setClickedLocation: (location: { lat: number; lng: number } | null) => void;
}

export const useMapClick = ({
    navigationMode,
    onSelectPlace,
    setClickedLocation,
}: UseMapClickParams) => {
    const handleMapClick = useCallback(
        (lngLat: [number, number], event?: any) => {
            if (navigationMode) return;

            const [lng, lat] = lngLat;

            const getFeatureName = (props: any): string | undefined =>
                props?.name ||
                props?.['name:latin'] ||
                props?.['name:en'] ||
                props?.name_en ||
                props?.['name:am'] ||
                props?.name_am;

            let clickedFeature = null;
            if (event?.features && event.features.length > 0) {
                clickedFeature = event.features.find(
                    (f: any) => f?.geometry?.type === 'Point' && getFeatureName(f.properties)
                );
            }

            if (clickedFeature) {
                const featureName = getFeatureName(clickedFeature.properties)!;


                const place: GeocodingPlace = {
                    id: '',
                    name: featureName,
                    display_name: featureName,
                    category: '',
                    location: { lat, lng },
                    address: { country: '', country_code: '' },
                    latitude: lat,
                    longitude: lng,
                    type: clickedFeature.properties.class || clickedFeature.properties.type || 'place',
                    Country: '',
                    City: '',
                };

                setClickedLocation({ lat, lng });

                onSelectPlace(place);
            }
        },
        [navigationMode, onSelectPlace, setClickedLocation]
    );

    const handleMapLongPress = useCallback(
        async (lngLat: [number, number]) => {
            if (navigationMode) return;

            const [lng, lat] = lngLat;

            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

            const coordsLabel = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

            const lang = i18n.language === 'am' ? 'AM' : 'EN';
            const address = await exploreService.requestAddress(lat, lng, lang);

            const clickedPlace: GeocodingPlace = {
                id: '',
                name: address?.district || address?.city || coordsLabel,
                display_name: coordsLabel,
                category: '',
                location: { lat, lng },
                address: { city: address?.city || '', country: address?.country || '', country_code: '' },
                latitude: lat,
                longitude: lng,
                type: 'coordinates',
                Country: address?.country || '',
                City: address?.city || '',
                District: address?.district || '',
            };

            setClickedLocation({ lat, lng });

            onSelectPlace(clickedPlace);
        },
        [navigationMode, onSelectPlace, setClickedLocation]
    );

    return { handleMapClick, handleMapLongPress };
};
