import { Stack } from 'expo-router';
import { createScreenLayout } from '../../shared/layout/ResponsiveScreen';
import { LocationProvider } from '../../shared/contexts/LocationContext';

const screenLayout = createScreenLayout({
    fullBleed: ['map-picker'],
    forms: ['add', 'add-home', 'save', 'claim'],
});

export default function PlacesLayout() {
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
                <Stack.Screen name="collection" options={{ title: 'My collection', headerShown: false }} />
                <Stack.Screen name="offer" options={{ title: 'Offer', headerShown: false }} />
                <Stack.Screen name="counter" options={{ title: 'Offer', headerShown: false, gestureEnabled: false, animation: 'fade' }} />
                <Stack.Screen name="offer-done" options={{ title: 'Offer', headerShown: false, gestureEnabled: false }} />
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
