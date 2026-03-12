import { Stack } from 'expo-router';
import { LocationProvider } from '../../shared/contexts/LocationContext';

export default function RulesLayout() {
    return (
        <LocationProvider>
            <Stack
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
