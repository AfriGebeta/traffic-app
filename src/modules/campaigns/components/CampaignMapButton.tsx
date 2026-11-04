import React, { useEffect, useRef, useState } from 'react';
import { Dimensions, Image, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { useGlass } from '../../../shared/theme/glass';
import { GlassSheen } from '../../../shared/components/GlassSheen';
import { setHomeCompassSlot } from '../../../shared/utils/homeCompassSlot';
import { CopilotStep } from 'react-native-copilot';
import { TourTouchable } from '../tour/walkthroughables';
import { useTourCampaign } from '../tour/useTourCampaign';

const AnnouncementLight = require('../../../../assets/images/announcement-light.png');
const AnnouncementDark = require('../../../../assets/images/announcement-dark.png');

const LABEL_HEIGHT = 40;
const LABEL_GAP = 8;
// space between this button and the home compass under it
const COMPASS_GAP = 32;
// room for the hidden measuring copy of the label
const MEASURE_WIDTH = 400;
const REVEAL_HOLD_MS = 4000;

// the label slides out once per app launch, not every time the home map comes back
let revealedThisLaunch = false;

export function CampaignMapButton() {
    const router = useRouter();
    const { t } = useTranslation();
    const { colors: theme, isDark } = useTheme();
    const glass = useGlass();
    const [contentWidth, setContentWidth] = useState(0);
    const progress = useSharedValue(0);
    const rowRef = useRef<View>(null);

    const label = t('campaigns');
    // last map step of every campaign tour: where their campaigns live
    const tourStepActive = useTourCampaign().stage === 'map-report';

    useEffect(() => {
        if (contentWidth <= 0 || revealedThisLaunch) return;
        revealedThisLaunch = true;
        progress.value = withSequence(
            withTiming(1, { duration: 350, easing: Easing.out(Easing.cubic) }),
            withDelay(REVEAL_HOLD_MS, withTiming(0, { duration: 300, easing: Easing.in(Easing.cubic) }))
        );
    }, [contentWidth, progress]);

    const labelStyle = useAnimatedStyle(() => ({
        width: progress.value * contentWidth,
        opacity: progress.value,
    }));

    const open = () => router.push('/campaigns');

    return (
        <View
            ref={rowRef}
            className="mt-3 flex-row items-center self-end"
            // the home compass sits under this button, so tell it where this button ends on screen
            onLayout={() =>
                rowRef.current?.measureInWindow((x, y, width, height) =>
                    setHomeCompassSlot({ top: y + height + COMPASS_GAP, right: Dimensions.get('window').width - (x + width) })
                )
            }
        >
            <Animated.View style={[{ overflow: 'hidden', alignItems: 'flex-end' }, labelStyle]}>
                <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={open}
                    className="rounded-full justify-center px-4"
                    style={[glass.surface, { height: LABEL_HEIGHT, marginRight: LABEL_GAP, width: Math.max(0, contentWidth - LABEL_GAP) }]}
                >
                    <GlassSheen />
                    <Text numberOfLines={1} style={{ color: theme.textPrimary, fontWeight: '600', fontSize: 15 }}>
                        {label}
                    </Text>
                </TouchableOpacity>
            </Animated.View>

            <CopilotStep name="campaigns" order={3} text={t('tour-campaigns-text')} active={tourStepActive}>
                <TourTouchable
                    activeOpacity={0.7}
                    onPress={open}
                    accessibilityRole="button"
                    accessibilityLabel={t('campaigns')}
                    className="rounded-full p-3"
                    style={glass.surface}
                >
                    <GlassSheen />
                    {/* thin line art, matching the layers / location / taxi / SOS buttons */}
                    <Image source={isDark ? AnnouncementDark : AnnouncementLight} style={{ width: 24, height: 24 }} />
                </TourTouchable>
            </CopilotStep>

            {/* measures the label's natural width; a wide box so the button-sized row can't squeeze it */}
            <View pointerEvents="none" style={{ position: 'absolute', opacity: 0, right: 0, width: MEASURE_WIDTH }}>
                <View
                    className="px-4"
                    style={{ alignSelf: 'flex-end', borderWidth: 1 }}
                    onLayout={(e) => setContentWidth(Math.ceil(e.nativeEvent.layout.width) + LABEL_GAP)}
                >
                    <Text numberOfLines={1} style={{ fontWeight: '600', fontSize: 15 }}>
                        {label}
                    </Text>
                </View>
            </View>
        </View>
    );
}
