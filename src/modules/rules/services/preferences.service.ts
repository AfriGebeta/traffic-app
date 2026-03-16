import AsyncStorage from '@react-native-async-storage/async-storage';

const RULE_PREFERENCES_KEY = '@rule_preferences';

export interface RulePreferences {
    showOnMap: boolean;
}

const DEFAULT_PREFERENCES: RulePreferences = {
    showOnMap: false,
};

export const rulePreferencesService = {
    async getPreferences(): Promise<RulePreferences> {
        try {
            const stored = await AsyncStorage.getItem(RULE_PREFERENCES_KEY);
            if (stored) {
                return JSON.parse(stored);
            }
            return DEFAULT_PREFERENCES;
        } catch (error) {
            // console.error('Failed to load rule preferences:', error);
            return DEFAULT_PREFERENCES;
        }
    },

    async savePreferences(preferences: RulePreferences): Promise<void> {
        try {
            await AsyncStorage.setItem(RULE_PREFERENCES_KEY, JSON.stringify(preferences));
        } catch (error) {
            // console.error('Failed to save rule preferences:', error);
            throw error;
        }
    },

    async toggleShowOnMap(): Promise<boolean> {
        try {
            const current = await this.getPreferences();
            const updated = { ...current, showOnMap: !current.showOnMap };
            await this.savePreferences(updated);
            return updated.showOnMap;
        } catch (error) {
            // console.error('Failed to toggle show on map:', error);
            throw error;
        }
    },
};
