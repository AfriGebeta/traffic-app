import { useState, useEffect } from 'react';
import { rulePreferencesService, RulePreferences } from '../services/preferences.service';

export const useRulePreferences = () => {
    const [preferences, setPreferences] = useState<RulePreferences>({ showOnMap: false });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadPreferences();
    }, []);

    const loadPreferences = async () => {
        try {
            const prefs = await rulePreferencesService.getPreferences();
            console.log('[RulePrefs] loaded from storage — showOnMap:', prefs.showOnMap);
            setPreferences(prefs);
        } catch (error) {
            console.log('[RulePrefs] load error:', error);
        } finally {
            setLoading(false);
        }
    };

    const toggleShowOnMap = async () => {
        try {
            const newValue = await rulePreferencesService.toggleShowOnMap();
            setPreferences(prev => ({ ...prev, showOnMap: newValue }));
            return newValue;
        } catch (error) {
            // console.error('Failed to toggle show on map:', error);
            throw error;
        }
    };

    return {
        preferences,
        loading,
        toggleShowOnMap,
        refetch: loadPreferences,
    };
};
