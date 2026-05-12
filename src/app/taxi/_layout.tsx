import { Stack } from 'expo-router';
import { RouteBuilderProvider } from '../../modules/taxi/contexts/RouteBuilderContext';

export default function TaxiLayout() {
    return (
        <RouteBuilderProvider>
            <Stack
                screenOptions={{
                    headerShown: false,
                }}
            >
                <Stack.Screen name="build-route" />
                <Stack.Screen name="map-picker" />
                <Stack.Screen name="set-pricing" />
            </Stack>
        </RouteBuilderProvider>
    );
}
