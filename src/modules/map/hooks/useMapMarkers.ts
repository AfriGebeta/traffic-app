import { useEffect } from 'react';
import type { GebetaMapRef } from '../../../lib/gebeta-map/GebetaMap';
import { getIncidentIconUrl, getIncidentColor, getIncidentIconName } from '../../incidents/utils/incidentIcons';
import { showToast } from '../../../shared/utils/toast';
import type { Incident } from '../../incidents/types/incident.types';

export const useMapMarkers = (
    mapRef: React.RefObject<GebetaMapRef | null>,
    incidents: Incident[]
) => {
    const addIncidentMarkers = () => {
        if (!mapRef.current || incidents.length === 0) {
            return;
        }

        try {
            incidents.forEach((incident) => {
                const iconUrl = getIncidentIconUrl(incident.type);
                const color = getIncidentColor(incident.type);
                const iconName = getIncidentIconName(incident.type);

                mapRef.current?.addImageMarker(
                    [incident.lng, incident.lat],
                    iconUrl,
                    [40, 40],
                    () => {
                        showToast.info(
                            incident.description,
                            `${incident.type.label} Incident`
                        );
                    },
                    10,
                    undefined,
                    color,
                    iconName
                );
            });
        } catch (error) {
            console.log('error adding markers:', error);
        }
    };

    useEffect(() => {
        if (incidents.length > 0 && mapRef.current) {
            addIncidentMarkers();
        }
    }, [incidents]);

    return { addIncidentMarkers };
};
