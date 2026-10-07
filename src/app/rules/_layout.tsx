import { Stack } from 'expo-router';
import { createScreenLayout } from '../../shared/layout/ResponsiveScreen';
import { LocationProvider } from '../../shared/contexts/LocationContext';

const screenLayout = createScreenLayout({
    fullBleed: ['map-picker'],
    forms: ['add'],
});

export default function RulesLayout() {
    return (
        <LocationProvider>
            <Stack
                screenLayout={screenLayout}
                screenOptions={{
                    headerShown: true,
                    headerStyle: {
                        backgroundColor: '#fff',
                    },
                    headerTintColor: '#000',
                    headerTitleStyle: {
                        fontWeight: 'bold',
                    },
                }}
            >
                <Stack.Screen
                    name="contribute"
                    options={{
                        title: 'Report Traffic Rule',
                        headerShown: false,
                    }}
                />
                <Stack.Screen
                    name="add"
                    options={{
                        title: 'Add Rule Report',
                        headerShown: false,
                    }}
                />
                <Stack.Screen
                    name="map-picker"
                    options={{
                        title: 'Pick Location',
                    }}
                />
            </Stack>
        </LocationProvider>
    );
}
