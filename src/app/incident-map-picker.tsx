import React from 'react';
import { Stack } from 'expo-router';
import MapPickerScreen from '../modules/places/screens/MapPickerScreen';

export default function IncidentMapPicker() {
    return (
        <>
            <Stack.Screen options={{ headerShown: true, title: 'Pick Location' }} />
            <MapPickerScreen />
        </>
    );
}
