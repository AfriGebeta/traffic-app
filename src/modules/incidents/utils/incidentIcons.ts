import { IncidentTypeFromAPI, INCIDENT_COLOR_MAP, INCIDENT_ICON_MAP } from '../types/incident.types';

export const getIncidentIconUrl = (type: IncidentTypeFromAPI): string => {
    return ''; // use colored markers
};

export const getIncidentColor = (type: IncidentTypeFromAPI): string => {
    return INCIDENT_COLOR_MAP[type.name] || '#F97316';
};

export const getIncidentIconName = (type: IncidentTypeFromAPI): string => {
    return INCIDENT_ICON_MAP[type.name] || 'alert-circle';
};

