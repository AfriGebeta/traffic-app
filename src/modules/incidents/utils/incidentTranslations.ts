import { IncidentType } from '../types/incident.types';

// Map incident type IDs to translation keys
export const getIncidentTranslationKey = (type: IncidentType): string => {
    const keyMap: Record<IncidentType, string> = {
        'police': 'traffic-police',
        'traffic': 'traffic',
        'crash': 'crash',
        'accident': 'accident',
        'closure': 'closure',
        'hazard': 'hazard',
        'weather': 'bad-weather',
        'broken-road': 'broken-road',
    };

    return keyMap[type] || type;
};
