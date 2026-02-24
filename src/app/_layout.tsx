import { Stack } from "expo-router";
import Toast from 'react-native-toast-message';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MapThemeProvider } from '../modules/map/context/MapThemeContext';
import { useEffect } from 'react';
import * as NavigationBar from 'expo-navigation-bar';
import { Platform } from 'react-native';
import './globals.css';
import '../shared/utils/localization/i18n';

export default function RootLayout() {
  useEffect(() => {
    if (Platform.OS === 'android') {
      try {
        NavigationBar.setBackgroundColorAsync('#ffffff');
        NavigationBar.setButtonStyleAsync('dark');
      } catch (error) {
        
      }
    }
  }, []);

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <MapThemeProvider>
          <Stack
            screenOptions={{
              headerShown: false,
            }}
          />
          <Toast />
        </MapThemeProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
