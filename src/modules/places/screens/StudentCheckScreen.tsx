import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { PhotoPicker, UploadedPhoto } from '../../../shared/components/PhotoPicker';
import { showToast } from '../../../shared/utils/toast';
import { FONT_MEDIUM, RADIUS, RADIUS_SM, SkeletonBlock, tint } from '../../campaigns/components/CampaignUi';
import { useAuthGate } from '../../register/hooks/useAuthGate';
import { businessService } from '../services/business.service';
import { isActive, pickLabel, usePlaceCatalog } from '../services/placeCatalog';
import { setStudentCheck, useStudentCheck } from '../hooks/useStudentCheck';
import { StudentCheck } from '../types/business.types';

type Step = 'school' | 'photo';

export default function StudentCheckScreen() {
    const { t, i18n } = useTranslation();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { colors: theme } = useTheme();
    const lang = i18n.language;
    const { catalog } = usePlaceCatalog();
    const { requireAuth } = useAuthGate();
    const { check, loaded } = useStudentCheck();
    const [resending, setResending] = useState(false);
    const [step, setStep] = useState<Step>('school');
    const [areaKey, setAreaKey] = useState<string | null>(null);
    const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
    const [sending, setSending] = useState(false);

    const schools = (catalog?.campusAreas ?? []).filter(isActive);
    const areaLabel = (key: string) => pickLabel(schools.find((s) => s.key === key)?.label ?? catalog?.campusAreas.find((s) => s.key === key)?.label, lang, key);
    const showForm = loaded && (!check || resending);

    const send = async () => {
        if (!areaKey || !photos[0] || sending) return;
        if (!(await requireAuth())) return;
        setSending(true);
        try {
            const sent = await businessService.sendStudentCheck({ kind: 'student', areaKey, photoKey: photos[0].objectName });
            setStudentCheck(sent);
            setResending(false);
            setStep('school');
            setPhotos([]);
        } catch (e) {
            showToast(e instanceof Error ? e.message : t('could-not-send'));
        } finally {
            setSending(false);
        }
    };

    const startAgain = () => {
        setResending(true);
        setStep('school');
        setAreaKey(check?.areaKey ?? null);
        setPhotos([]);
    };

    return (
        <View className="flex-1" style={{ backgroundColor: theme.background, paddingTop: insets.top }}>
            <View className="px-4 pt-3 pb-2">
                <TouchableOpacity
                    onPress={() => (showForm && step === 'photo' ? setStep('school') : router.back())}
                    className="self-start p-1 -ml-1"
                    activeOpacity={0.7}
                    hitSlop={8}
                    accessibilityLabel={t('back')}
                >
                    <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
                </TouchableOpacity>
                <Text className="mt-3" style={{ color: theme.textPrimary, fontSize: 28, lineHeight: 34, letterSpacing: -0.4 }}>
                    {t('student-check-title')}
                </Text>
                {showForm && (
                    <View className="mt-3 h-1 overflow-hidden" style={{ borderRadius: 999, backgroundColor: theme.border }}>
                        <View style={{ height: '100%', width: step === 'school' ? '50%' : '100%', borderRadius: 999, backgroundColor: theme.primary }} />
                    </View>
                )}
            </View>

            <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingTop: 12, paddingBottom: 24, gap: 12 }}>
                {!loaded && (
                    <>
                        <SkeletonBlock height={96} />
                        <SkeletonBlock height={48} />
                    </>
                )}

                {loaded && !showForm && !!check && <StatusCard check={check} areaLabel={areaLabel(check.areaKey)} />}

                {showForm && step === 'school' && (
                    <>
                        <Text style={{ color: theme.textPrimary, fontFamily: FONT_MEDIUM, fontSize: 18 }}>{t('student-check-school-title')}</Text>
                        <Text className="text-sm" style={{ color: theme.textSecondary }}>{t('student-check-school-hint')}</Text>
                        {schools.map((school) => {
                            const selected = areaKey === school.key;
                            return (
                                <TouchableOpacity
                                    key={school.key}
                                    onPress={() => setAreaKey(school.key)}
                                    activeOpacity={0.7}
                                    accessibilityRole="radio"
                                    accessibilityState={{ selected }}
                                    className="flex-row items-center px-4"
                                    style={{
                                        minHeight: 52,
                                        borderRadius: RADIUS_SM,
                                        borderWidth: 1,
                                        borderColor: selected ? theme.primary : theme.border,
                                        backgroundColor: selected ? tint(theme.primary, '14') : theme.background,
                                    }}
                                >
                                    <Text className="flex-1" style={{ color: theme.textPrimary, fontFamily: selected ? FONT_MEDIUM : undefined, fontSize: 15 }}>
                                        {pickLabel(school.label, lang, school.key)}
                                    </Text>
                                    {selected && <Ionicons name="checkmark" size={18} color={theme.primary} />}
                                </TouchableOpacity>
                            );
                        })}
                    </>
                )}

                {showForm && step === 'photo' && (
                    <>
                        <Text style={{ color: theme.textPrimary, fontFamily: FONT_MEDIUM, fontSize: 18 }}>{t('student-check-photo-title')}</Text>
                        <Text className="text-sm" style={{ color: theme.textSecondary }}>{t('student-check-photo-hint')}</Text>
                        {/* one photo; taking another replaces it */}
                        <PhotoPicker photos={photos} onChange={(next) => setPhotos(next.slice(-1))} folder="student-ids" horizontalPadding={32} cameraOnly />
                        <View className="flex-row items-center">
                            <Ionicons name="lock-closed-outline" size={14} color={theme.textSecondary} />
                            <Text className="text-xs ml-1.5" style={{ color: theme.textSecondary }}>{t('student-check-private')}</Text>
                        </View>
                    </>
                )}
            </ScrollView>

            <View className="px-4 pt-3" style={{ paddingBottom: insets.bottom + 12, borderTopWidth: 1, borderTopColor: theme.border }}>
                {showForm ? (
                    <TouchableOpacity
                        onPress={() => (step === 'school' ? setStep('photo') : void send())}
                        disabled={step === 'school' ? !areaKey : !photos[0] || sending}
                        activeOpacity={0.8}
                        className="items-center justify-center"
                        style={{ height: 48, borderRadius: RADIUS, backgroundColor: theme.primary, opacity: (step === 'school' ? !areaKey : !photos[0] || sending) ? 0.5 : 1 }}
                    >
                        {sending ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={{ color: '#fff', fontFamily: FONT_MEDIUM, fontSize: 15 }}>{t(step === 'school' ? 'continue' : 'student-check-send')}</Text>
                        )}
                    </TouchableOpacity>
                ) : (
                    loaded && (
                        <TouchableOpacity
                            onPress={check && (check.status === 'REJECTED' || check.status === 'EXPIRED') ? startAgain : () => router.back()}
                            activeOpacity={0.8}
                            className="items-center justify-center"
                            style={{ height: 48, borderRadius: RADIUS, backgroundColor: theme.primary }}
                        >
                            <Text style={{ color: '#fff', fontFamily: FONT_MEDIUM, fontSize: 15 }}>
                                {t(check && (check.status === 'REJECTED' || check.status === 'EXPIRED') ? 'student-check-send-again' : 'done')}
                            </Text>
                        </TouchableOpacity>
                    )
                )}
            </View>
        </View>
    );
}

function StatusCard({ check, areaLabel }: { check: StudentCheck; areaLabel: string }) {
    const { t, i18n } = useTranslation();
    const { colors: theme } = useTheme();
    const tone = { APPROVED: theme.green, PENDING: theme.textSecondary, REJECTED: theme.error, EXPIRED: theme.textSecondary }[check.status];
    const icon = ({ APPROVED: 'shield-checkmark', PENDING: 'time-outline', REJECTED: 'close-circle-outline', EXPIRED: 'alert-circle-outline' } as const)[check.status];
    const until = check.validUntil ? new Date(check.validUntil).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short', year: 'numeric' }) : '';
    return (
        <View className="p-4 gap-1.5" style={{ borderRadius: RADIUS, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface }}>
            <View className="flex-row items-center">
                <Ionicons name={icon} size={20} color={tone} />
                <Text className="ml-2" style={{ color: tone, fontFamily: FONT_MEDIUM, fontSize: 15 }}>{t(`student-check-${check.status.toLowerCase()}`)}</Text>
            </View>
            <Text style={{ color: theme.textPrimary, fontSize: 15 }}>{areaLabel}</Text>
            <Text className="text-sm" style={{ color: theme.textSecondary }}>
                {check.status === 'APPROVED' && until
                    ? t('student-check-valid-until', { date: until })
                    : check.status === 'PENDING'
                      ? t('student-check-pending-hint')
                      : check.status === 'EXPIRED'
                        ? t('student-check-expired-hint')
                        : ''}
            </Text>
            {check.status === 'REJECTED' && !!check.note && (
                <Text className="text-sm" style={{ color: theme.textPrimary }}>{check.note}</Text>
            )}
        </View>
    );
}
