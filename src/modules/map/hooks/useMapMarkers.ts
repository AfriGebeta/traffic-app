import { useEffect, useRef } from 'react';
import type { GebetaMapRef } from '@gebeta/tiles-react-native';
import type { Incident } from '../../incidents/types/incident.types';

export const useMapMarkers = (
    mapRef: React.RefObject<GebetaMapRef | null>,
    incidents: Incident[]
) => {
    const incidentMarkersRef = useRef<any[]>([]);

    const addIncidentMarkers = () => {

    };

    useEffect(() => {
        console.log('useMapMarkers effect triggered:', {
            incidentCount: incidents.length,
            hasMapRef: !!mapRef.current
        });
    }, [incidents]);

    return { addIncidentMarkers };
};
