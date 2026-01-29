import { IncidentTypeFromAPI } from '../types/incident.types';

export const getIncidentTranslationKey = (type: IncidentTypeFromAPI | string): string => {
    const typeName = (typeof type === 'string' ? type : type.name).trim();


    const keyMap: Record<string, string> = {
        'TRAFFIC_POLICE': 'traffic-police',
        'traffic-police': 'traffic-police',
        'police': 'traffic-police',
        'TRAFFIC_JAM': 'traffic-jam',
        'traffic-jam': 'traffic-jam',
        'traffic_jam': 'traffic-jam',
        'CRASH': 'crash',
        'crash': 'crash',
        'ACCIDENT': 'accident',
        'accident': 'accident',
        'ROAD_CLOSURE': 'closure',
        'closure': 'closure',
        'road-closure': 'closure',
        'SPEED_BUMP': 'speed-bump',
        'speed-bump': 'speed-bump',
        'speed_bump': 'speed-bump',
        'POT_HOLE': 'pot-hole',
        'pot-hole': 'pot-hole',
        'pot_hole': 'pot-hole',
        'FLOODING': 'flooding',
        'flooding': 'flooding',
        'GATED_COMMUNITY': 'gated-community',
        'gated-community': 'gated-community',
        'gated_community': 'gated-community',
        'OTHER': 'other',
        'other': 'other',
    };

    const translationKey = keyMap[typeName] || typeName.toLowerCase().replace('_', '-');
    return translationKey;
};
