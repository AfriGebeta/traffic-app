import { IncidentType } from '../types/incident.types';

export const getIncidentIconUrl = (type: IncidentType): string => {
    return ''; // use colored markers
};

export const getIncidentColor = (type: IncidentType): string => {
    const colorMap: Record<IncidentType, string> = {
        traffic: '#EF4444',
        police: '#3B82F6',
        crash: '#F59E0B',
        accident: '#F59E0B',
        closure: '#8B5CF6',
        hazard: '#EC4899',
        weather: '#6B7280',
        'broken-road': '#F97316',
    };

    return colorMap[type] || colorMap.hazard;
};

export const getIncidentIconName = (type: IncidentType): string => {
    const iconMap: Record<IncidentType, string> = {
        traffic: 'car',
        police: 'shield',
        crash: 'warning',
        accident: 'warning',
        closure: 'close-circle',
        hazard: 'alert-circle',
        weather: 'rainy',
        'broken-road': 'construct',
    };

    return iconMap[type] || 'alert-circle';
};
