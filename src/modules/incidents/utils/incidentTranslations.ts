import { IncidentTypeFromAPI } from '../types/incident.types';

export const getIncidentTranslationKey = (type: IncidentTypeFromAPI | string): string => {
    const typeName = (typeof type === 'string' ? type : type.name).trim();


    const keyMap: Record<string, string> = {
        'ROAD_CLOSURE': 'closure',
        'closure': 'closure',
        'road-closure': 'closure',
        'ACCIDENT': 'accident',
        'accident': 'accident',
        'TRAFFIC_JAM': 'traffic-jam',
        'traffic-jam': 'traffic-jam',
        'traffic_jam': 'traffic-jam',
        'BAD_WEATHER': 'bad-weather',
        'bad-weather': 'bad-weather',
        'bad_weather': 'bad-weather',
        'HAZARD': 'hazard',
        'hazard': 'hazard',
        'CRASH': 'crash',
        'crash': 'crash',
        'GATED_COMMUNITY': 'gated-community',
        'gated-community': 'gated-community',
        'gated_community': 'gated-community',
        'BROKEN_ROAD': 'broken-road',
        'broken-road': 'broken-road',
        'broken_road': 'broken-road',
        'RADAR': 'radar',
        'radar': 'radar',
        'FLOOD': 'flood',
        'flood': 'flood',
        'OTHER': 'other',
        'other': 'other',
    };

    const translationKey = keyMap[typeName] || typeName.toLowerCase().replace('_', '-');
    return translationKey;
};
