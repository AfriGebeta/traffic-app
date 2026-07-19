import { Stack } from 'expo-router';
import { LocationProvider } from '../../shared/contexts/LocationContext';

export default function PlacesLayout() {
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
                        title: 'Contribute Place',
                        headerShown: false,
                    }}
                />
                <Stack.Screen
                    name="add"
                    options={{
                        title: 'Add Place Details',
                        headerShown: false,
                    }}
                />
                <Stack.Screen
                    name="map-picker"
                    options={{
                        title: 'Pick Location',
                    }}
                />
                <Stack.Screen
                    name="add-home"
                    options={{
                        title: 'Add Home Address',
                        headerShown: false,
                    }}
                />
                <Stack.Screen
                    name="save"
                    options={{
                        title: 'Save Place',
                        headerShown: false,
                    }}
                />
                <Stack.Screen
                    name="claim"
                    options={{
                        title: 'Claim Business',
                        headerShown: false,
                    }}
                />
            </Stack>
        </LocationProvider>
    );
}
