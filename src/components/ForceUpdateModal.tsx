import { Modal, View, Text, Linking, Pressable } from 'react-native';
import { colors } from '../shared/theme/colors';

const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=co.gebeta.apps.android.map';  //safe

export function ForceUpdateModal({ visible }: { visible: boolean }) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
        <View className="bg-white rounded-2xl p-7 mx-8 items-center">
          <Text className="text-xl font-bold text-gray-800 mb-3">Update Required</Text>
          <Text className="text-sm text-gray-500 text-center leading-6 mb-6">
            A new version of Gebeta Maps is available. Please update to continue using the app.
          </Text>
          <Pressable
            className="rounded-xl py-3 px-10"
            style={{ backgroundColor: colors.primary.main }}
            onPress={() => Linking.openURL(PLAY_STORE_URL)}
          >
            <Text className="text-white font-bold text-base">Update Now</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
