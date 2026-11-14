import React, { useState } from 'react';
import { ActivityIndicator, Modal, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { FONT_MEDIUM, FONT_SEMIBOLD, RADIUS, RADIUS_SM } from './CampaignUi';
import { getCampaignIntroVideo } from '../../../shared/config/remoteConfigValues';
import i18n from '../../../shared/utils/localization/i18n';

// accepts a bare id or any youtube link: watch?v=, youtu.be/, shorts/, embed/, live/
export const youtubeId = (value: string | undefined): string | null => {
    const text = value?.trim();
    if (!text) return null;
    if (/^[\w-]{11}$/.test(text)) return text;
    const match = text.match(/(?:[?&]v=|youtu\.be\/|\/(?:shorts|embed|live)\/)([\w-]{11})/);
    return match ? match[1] : null;
};

// read when needed, not at import: Remote Config hydrates after app start.
// amharic users get the amharic video when it's set, otherwise the default one
export const campaignIntroVideoId = () => youtubeId(getCampaignIntroVideo(i18n.language));

// youTube refuses embeds without a referrer (error 153), so the page gets an https base url
const EMBED_ORIGIN = 'https://gebeta.app';

const embedHtml = (videoId: string) => `<!doctype html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;height:100%;background:#000}iframe{border:0;width:100%;height:100%}</style>
</head><body>
<iframe src="https://www.youtube-nocookie.com/embed/${videoId}?playsinline=1&rel=0&modestbranding=1"
 allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>
</body></html>`;

interface CampaignVideoModalProps {
    visible: boolean;
    videoId?: string;
    onClose: () => void;
}

export const CampaignVideoModal = ({ visible, videoId: videoIdProp, onClose }: CampaignVideoModalProps) => {
    const videoId = videoIdProp ?? campaignIntroVideoId();
    const { t } = useTranslation();
    const { colors: theme } = useTheme();
    const { width, height } = useWindowDimensions();
    const [loading, setLoading] = useState(true);
    const maxPlayerWidth = Math.min(width, 520) - 64;
    const maxPlayerHeight = height - 240;
    const playerHeight = Math.min((maxPlayerWidth * 16) / 9, maxPlayerHeight);
    const playerWidth = (playerHeight * 9) / 16;

    return (
        <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
            <View className="flex-1 items-center justify-center px-4" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
                <View className="w-full p-4" style={{ maxWidth: 520, borderRadius: RADIUS, backgroundColor: theme.background }}>
                    <Text style={{ color: theme.textPrimary, fontFamily: FONT_SEMIBOLD, fontSize: 17 }}>{t('campaign-video-title')}</Text>
                    <Text className="mt-1 mb-3" style={{ color: theme.textSecondary, fontSize: 13, lineHeight: 18 }}>
                        {t('campaign-video-hint')}
                    </Text>

                    <View style={{ width: playerWidth, height: playerHeight, alignSelf: 'center', borderRadius: RADIUS_SM, overflow: 'hidden', backgroundColor: '#000' }}>
                        {visible && !!videoId && (
                            <WebView
                                source={{ html: embedHtml(videoId), baseUrl: EMBED_ORIGIN }}
                                allowsFullscreenVideo
                                allowsInlineMediaPlayback
                                mediaPlaybackRequiresUserAction={false}
                                javaScriptEnabled
                                onLoadEnd={() => setLoading(false)}
                                style={{ backgroundColor: '#000' }}
                            />
                        )}
                        {loading && (
                            <View className="absolute inset-0 items-center justify-center">
                                <ActivityIndicator color="#fff" />
                            </View>
                        )}
                    </View>

                    <TouchableOpacity
                        onPress={onClose}
                        activeOpacity={0.7}
                        className="mt-4 items-center justify-center"
                        style={{ height: 48, borderRadius: RADIUS_SM, backgroundColor: theme.primary }}
                    >
                        <Text style={{ color: '#fff', fontFamily: FONT_MEDIUM, fontSize: 15 }}>{t('continue')}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

export default CampaignVideoModal;
