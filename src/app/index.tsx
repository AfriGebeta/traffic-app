import React, { useRef } from 'react';
import { View, Alert, Button, StyleSheet } from 'react-native';
import GebetaMap, { GebetaMapRef } from '@gebeta/tiles-react-native';

export default function Index() {
  const mapRef = useRef<GebetaMapRef>(null);

  const handleMapClick = (lngLat: [number, number]) => {
    Alert.alert(
      'Map Clicked',
      `Longitude: ${lngLat[0].toFixed(6)}\nLatitude: ${lngLat[1].toFixed(6)}`
    );
  };

  const handleMapLoaded = () => {
    console.log('Map loaded successfully!');
    if (mapRef.current) {
      mapRef.current.addImageMarker(
        [38.7463, 9.0223], 
        'https://via.placeholder.com/32x32/007cbf/ffffff?text=M',
        [32, 32],
        (lngLat, marker, event) => {
          Alert.alert('Marker Clicked', 'You clicked on Addis Ababa!');
        }
      );
    }
  };

  const handleFlyToBahirDar = () => {
    if (mapRef.current) {
      mapRef.current.flyTo({
        center: [37.3895, 11.5946],
        zoom: 14,
        pitch: 45,
        duration: 5000,
      });
    }
  };

  return (
    <View style={styles.container}>
      <GebetaMap
        ref={mapRef}
        apiKey={process.env.EXPO_PUBLIC_GEBETA_API_KEY!}
        center={[38.7463, 9.0223]} 
        zoom={12}
        onMapClick={handleMapClick}
        onMapLoaded={handleMapLoaded}
      />

      <View style={styles.buttonContainer}>
        <Button title="✈️ Fly to Bahir Dar" onPress={handleFlyToBahirDar} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  buttonContainer: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
});
