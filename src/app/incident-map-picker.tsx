import React from 'react';
import { Stack } from 'expo-router';
import MapPickerScreen from '../modules/places/screens/MapPickerScreen';
import { useTheme } from '../shared/theme/ThemeContext';

export default function IncidentMapPicker() {
    const { colors: theme } = useTheme();
    return (
        <>
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: 'Pick Location',
                    headerStyle: { backgroundColor: theme.background },
                    headerTintColor: theme.textPrimary,
                }}
            />
            <MapPickerScreen />
        </>
    );
}
