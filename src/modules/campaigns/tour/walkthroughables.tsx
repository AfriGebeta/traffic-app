import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { walkthroughable } from 'react-native-copilot';

export const TourTouchable = walkthroughable((props: React.ComponentProps<typeof TouchableOpacity>) => <TouchableOpacity {...props} />);
export const TourView = walkthroughable((props: React.ComponentProps<typeof View>) => <View {...props} />);
