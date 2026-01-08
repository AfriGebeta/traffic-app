import { IncidentType } from '../types/incident.types';

// Map incident type IDs to translation keys
export const getIncidentTranslationKey = (type: IncidentType): string => {
    const keyMap: Record<IncidentType, string> = {
        'police': 'traffic-police',
        'traffic_jam': 'traffic-jam',
        'crash': 'crash',
        'accident': 'accident',
        'closure': 'closure',
        'speed_bump': 'speed-bump',
        'pot_hole': 'pot-hole',
        'flooding': 'flooding',
        'gated_community': 'gated-community',
        'other': 'other',
    };

    return keyMap[type] || type;
};
