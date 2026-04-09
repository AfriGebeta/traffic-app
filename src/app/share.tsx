import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { parseLocationUrl, type SharedLocation } from '../shared/utils/deepLinking';
import { showToast } from '../shared/utils/toast';

export default function ShareScreen() {
    const params = useLocalSearchParams();
    const router = useRouter();
    const [isProcessing, setIsProcessing] = useState(true);

    useEffect(() => {
        handleDeepLink();
    }, [params]);

    const handleDeepLink = async () => {
        try {
            const urlParams = new URLSearchParams();
            Object.entries(params).forEach(([key, value]) => {
                if (value) {
                    urlParams.append(key, Array.isArray(value) ? value[0] : value);
                }
            });

            const mockUrl = `https://maps.gebeta.app/?${urlParams.toString()}`;
            const location = parseLocationUrl(mockUrl);

            if (!location) {
                showToast.error('Invalid Link', 'Could not parse location from the shared link');
                router.replace('/');
                return;
            }

            router.replace({
                pathname: '/',
                params: {
                    sharedLat: location.lat.toString(),
                    sharedLng: location.lng.toString(),
                    sharedName: location.name || '',
                    sharedCity: location.city || '',
                    sharedCountry: location.country || '',
                    sharedType: location.type || '',
                },
            });

            showToast.success(
                'Location Shared',
                location.name ? `Opening ${location.name}` : 'Opening shared location'
            );
        } catch (error) {
            console.error('Deep link error:', error);
            showToast.error('Error', 'Could not open shared location');
            router.replace('/');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <View style={styles.container}>
            <ActivityIndicator size="large" color="#0066CC" />
            <Text style={styles.text}>Opening shared location...</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
    },
    text: {
        marginTop: 16,
        fontSize: 16,
        color: '#666',
    },
});
