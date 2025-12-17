import { Stack } from "expo-router";
import Toast from 'react-native-toast-message';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import './globals.css';
import '../shared/utils/localization/i18n';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      />
      <Toast />
    </GestureHandlerRootView>
  );
}
