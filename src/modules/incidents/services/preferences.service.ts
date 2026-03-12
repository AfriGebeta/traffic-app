import AsyncStorage from '@react-native-async-storage/async-storage';

const INCIDENT_FILTERS_KEY = '@traffic_app_incident_filters';

export interface IncidentFilters {
    enabledTypes: string[]; 
}

export const incidentPreferencesService = {
    async getFilters(): Promise<IncidentFilters> {
        try {
            const stored = await AsyncStorage.getItem(INCIDENT_FILTERS_KEY);
            if (stored) {
                return JSON.parse(stored);
            }
            //default: all
            return { enabledTypes: [] };
        } catch (error) {
            console.error('Failed to load incident filters:', error);
            return { enabledTypes: [] };
        }
    },

    async saveFilters(filters: IncidentFilters): Promise<void> {
        try {
            await AsyncStorage.setItem(INCIDENT_FILTERS_KEY, JSON.stringify(filters));
        } catch (error) {
            console.error('Failed to save incident filters:', error);
            throw error;
        }
    },

    async toggleIncidentType(typeName: string): Promise<IncidentFilters> {
        const current = await this.getFilters();
        const enabledTypes = current.enabledTypes;

        if (enabledTypes.length === 0) {

            const newFilters = { enabledTypes: [typeName] };
            await this.saveFilters(newFilters);
            return newFilters;
        }

        const index = enabledTypes.indexOf(typeName);
        if (index > -1) {
            enabledTypes.splice(index, 1);
        } else {
            enabledTypes.push(typeName);
        }

        const newFilters = { enabledTypes };
        await this.saveFilters(newFilters);
        return newFilters;
    },

    async isTypeEnabled(typeName: string): Promise<boolean> {
        const filters = await this.getFilters();
        if (filters.enabledTypes.length === 0) {
            return true;
        }
        return filters.enabledTypes.includes(typeName);
    },
};
