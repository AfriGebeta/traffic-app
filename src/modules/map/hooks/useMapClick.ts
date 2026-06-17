import { useCallback } from 'react';
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
        async (lngLat: [number, number], event?: any) => {
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
                clickedFeature = event.features.find((f: any) => getFeatureName(f.properties));
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
                return;
            }


            try {
                const place = await Promise.race([
                    exploreService.reverseGeocode(lat, lng),
                    new Promise<null>((resolve) => setTimeout(() => resolve(null), 800)),
                ]);

                // console.log('usemapclick:reverseGeocode result:', place ? place.name : 'null/timeout');

                if (place) {

                    setClickedLocation({ lat: place.latitude, lng: place.longitude });

                    onSelectPlace(place);
                    return;
                }
            } catch (error) {
                console.log('rev geocoding error:', error);
            }

            const clickedPlace: GeocodingPlace = {
                id: '',
                name: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
                display_name: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
                category: '',
                location: { lat, lng },
                address: { country: '', country_code: '' },
                latitude: lat,
                longitude: lng,
                type: 'coordinates',
                Country: '',
                City: '',
            };

            setClickedLocation({ lat, lng });

            onSelectPlace(clickedPlace);
        },
        [navigationMode, onSelectPlace, setClickedLocation]
    );

    return { handleMapClick };
};
