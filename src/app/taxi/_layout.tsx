import { Stack } from 'expo-router';
import { createScreenLayout } from '../../shared/layout/ResponsiveScreen';
import { RouteBuilderProvider } from '../../modules/taxi/contexts/RouteBuilderContext';

const screenLayout = createScreenLayout({
    fullBleed: ['map-picker', 'destination-picker', 'navigation', 'route-preview'],
    forms: ['add-station', 'set-pricing', 'set-availability'],
});

export default function TaxiLayout() {
    return (
        <RouteBuilderProvider>
            <Stack
                screenLayout={screenLayout}
                screenOptions={{
                    headerShown: false,
                }}
            >
                <Stack.Screen name="contribute" />
                <Stack.Screen name="build-route" />
                <Stack.Screen name="add-station" />
                <Stack.Screen name="map-picker" />
                <Stack.Screen name="set-pricing" />
            </Stack>
        </RouteBuilderProvider>
    );
}
