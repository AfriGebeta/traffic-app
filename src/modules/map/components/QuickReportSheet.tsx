import React from 'react';
import { View, Text, TouchableOpacity, Pressable, ScrollView, Image, ActivityIndicator, BackHandler, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
    SlideInDown,
    SlideOutDown,
    FadeIn,
    FadeOut,
    Easing,
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    cancelAnimation,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useTranslation } from '../../../shared/hooks/useTranslation';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { showToast } from '../../../shared/utils/toast';
import { dashboardEventsService } from '../../../shared/services/dashboard-events.service';
import { getReportErrorMessage, reportErrorFrom } from '../../../shared/utils/reportErrors';
import { incidentService } from '../../incidents/services/incident.service';
import { getIncidentTranslationKey } from '../../incidents/utils/incidentTranslations';
import { ruleService } from '../../rules/services/rule.service';
import { TrafficRuleType } from '../../rules/types/rule.types';
import { RULE_TRANSLATION_MAP, sortRuleTypes, NO_PUNISHMENT_VALUE } from '../../rules/utils/ruleTranslations';
import { INCIDENT_SVG_ICON_MAP } from './incidentIcons';

const AUTO_REPORT_MS = 5000;
const TILE_CIRCLE = 76;

let cachedRuleTypes: TrafficRuleType[] | null = null;

type Tab = 'incidents' | 'rules';

type Selection =
    | { kind: 'incident'; typeName: string }
    | { kind: 'rule'; rule: TrafficRuleType };

interface QuickReportSheetProps {
    incidentTypes: readonly { name: string; icon: string; color: string }[];
    onClose: () => void;
    userLocation: { lat: number; lng: number } | null;
    onNavigateToReport?: () => void;
}

export const QuickReportSheet: React.FC<QuickReportSheetProps> = ({
    incidentTypes,
    onClose,
    userLocation,
    onNavigateToReport,
}) => {
    const { t } = useTranslation();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { height: windowHeight } = useWindowDimensions();
    const { colors: theme, isDark } = useTheme();

    const [tab, setTab] = React.useState<Tab>('incidents');
    const [ruleTypes, setRuleTypes] = React.useState<TrafficRuleType[] | null>(cachedRuleTypes);
    const [selection, setSelection] = React.useState<Selection | null>(null);
    const [reportLocation, setReportLocation] = React.useState<{ lat: number; lng: number } | null>(null);

    const progress = useSharedValue(0);
    const autoReportTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const submitted = React.useRef(false);

    const circleBg = isDark ? theme.surface : '#F1F2F6';

    React.useEffect(() => {
        let cancelled = false;
        ruleService
            .getRuleTypes()
            .then((types) => {
                cachedRuleTypes = sortRuleTypes(types);
                if (!cancelled) setRuleTypes(cachedRuleTypes);
            })
            .catch((error) => {
                console.error('Failed to load rule types:', error);
                if (!cancelled) setRuleTypes((prev) => prev ?? []);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const stopCountdown = React.useCallback(() => {
        if (autoReportTimer.current) {
            clearTimeout(autoReportTimer.current);
            autoReportTimer.current = null;
        }
        cancelAnimation(progress);
    }, [progress]);

    React.useEffect(() => stopCountdown, [stopCountdown]);

    const backToGrid = React.useCallback(() => {
        stopCountdown();
        setSelection(null);
        setReportLocation(null);
    }, [stopCountdown]);

    const close = React.useCallback(() => {
        stopCountdown();
        onClose();
    }, [stopCountdown, onClose]);

    React.useEffect(() => {
        const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
            if (selection) backToGrid();
            else close();
            return true;
        });
        return () => backHandler.remove();
    }, [selection, backToGrid, close]);

    const submit = React.useCallback(
        async (sel: Selection, location: { lat: number; lng: number } | null) => {
            if (submitted.current) return;
            submitted.current = true;
            stopCountdown();
            onClose();

            if (!location) {
                showToast(t('location-unavailable'));
                return;
            }

            try {
                if (sel.kind === 'incident') {
                    const response = await incidentService.report({
                        lat: location.lat,
                        lng: location.lng,
                        type: sel.typeName,
                        description: 'No description provided',
                    });
                    if (response.error) throw Object.assign(new Error(response.error), { status: response.status });
                    showToast(t('incident-reported-successfully'));
                } else {
                    await ruleService.reportRule({
                        lat: location.lat,
                        lng: location.lng,
                        typeId: sel.rule.id,
                        punishment: NO_PUNISHMENT_VALUE,
                    });
                    showToast(t('traffic-rule-report-submitted'));
                }
                dashboardEventsService.contribute();
            } catch (error) {
                console.error('Quick report failed:', error);
                const { message, status } = reportErrorFrom(error);
                showToast(getReportErrorMessage(t, message, status));
            }
        },
        [stopCountdown, onClose, t]
    );

    const select = React.useCallback(
        (sel: Selection) => {
            const location = userLocation;
            setSelection(sel);
            setReportLocation(location);

            progress.value = 0;
            progress.value = withTiming(1, { duration: AUTO_REPORT_MS, easing: Easing.linear });
            autoReportTimer.current = setTimeout(() => {
                autoReportTimer.current = null;
                submit(sel, location);
            }, AUTO_REPORT_MS);
        },
        [userLocation, progress, submit]
    );

    const openDetails = React.useCallback(() => {
        if (!selection) return;
        stopCountdown();
        const lat = reportLocation?.lat.toString() ?? '';
        const lng = reportLocation?.lng.toString() ?? '';

        onNavigateToReport?.();
        if (selection.kind === 'incident') {
            const params = new URLSearchParams({
                typeName: selection.typeName,
                lat,
                lng,
                refresh: 'true',
                isNavigating: 'true',
            });
            router.push(`/incident-report?${params.toString()}`);
        } else {
            const { rule } = selection;
            const translationKeys = RULE_TRANSLATION_MAP[rule.name];
            router.push({
                pathname: '/rules/add',
                params: {
                    typeId: rule.id,
                    typeName: translationKeys ? t(translationKeys.name) : rule.name,
                    typeRawName: rule.name,
                    typeDescription: translationKeys ? t(translationKeys.description) : rule.description,
                    typeImg: rule.img,
                    isNavigating: 'true',
                    lat,
                    lng,
                    fromReportSheet: 'true',
                },
            });
        }
        onClose();
    }, [selection, reportLocation, stopCountdown, onNavigateToReport, router, t, onClose]);

    const progressStyle = useAnimatedStyle(() => ({
        width: `${progress.value * 100}%`,
    }));

    const ruleLabel = (rule: TrafficRuleType) => {
        const translationKeys = RULE_TRANSLATION_MAP[rule.name];
        return translationKeys ? t(translationKeys.name) : rule.name;
    };

    const renderIncidentIcon = (typeName: string, size: number, fallback?: { icon: string; color: string }) => {
        const iconPair = INCIDENT_SVG_ICON_MAP[typeName];
        const SvgIcon = iconPair ? (isDark ? iconPair.dark : iconPair.light) : null;
        if (SvgIcon) return <SvgIcon width={size} height={size} />;
        return <Ionicons name={(fallback?.icon ?? 'alert-circle') as any} size={size * 0.6} color={fallback?.color ?? '#F97316'} />;
    };

    const renderRuleIcon = (rule: TrafficRuleType, size: number) => (
        <Image source={{ uri: rule.img }} style={{ width: size, height: size }} resizeMode="contain" />
    );

    const renderTile = (key: string, label: string, icon: React.ReactNode, onPress: () => void, circleColor = circleBg) => (
        <TouchableOpacity key={key} style={styles.tile} onPress={onPress} activeOpacity={0.7}>
            <View style={[styles.circle, { backgroundColor: circleColor }]}>{icon}</View>
            <Text style={[styles.tileLabel, { color: theme.textPrimary }]} numberOfLines={2}>
                {label}
            </Text>
        </TouchableOpacity>
    );

    const ruleCircleBg = isDark ? '#FFFFFF' : circleBg;

    const renderGrid = () => {
        if (tab === 'incidents') {
            return (
                <View style={styles.grid}>
                    {incidentTypes.map((type) =>
                        renderTile(
                            type.name,
                            t(getIncidentTranslationKey(type.name)),
                            renderIncidentIcon(type.name, 52, type),
                            () => select({ kind: 'incident', typeName: type.name })
                        )
                    )}
                </View>
            );
        }

        if (ruleTypes === null) {
            return (
                <View style={styles.loading}>
                    <ActivityIndicator color={theme.primary} />
                </View>
            );
        }

        return (
            <View style={styles.grid}>
                {ruleTypes.map((rule) =>
                    renderTile(rule.id, ruleLabel(rule), renderRuleIcon(rule, 48), () => select({ kind: 'rule', rule }), ruleCircleBg)
                )}
            </View>
        );
    };

    const renderPicker = () => (
        <>
            <View style={styles.header}>
                <Text style={[styles.title, { color: theme.textPrimary }]}>{t('what-do-you-see')}</Text>
                <TouchableOpacity onPress={close} hitSlop={12} activeOpacity={0.7}>
                    <Ionicons name="close" size={28} color={theme.textPrimary} />
                </TouchableOpacity>
            </View>

            <View style={[styles.tabs, { backgroundColor: circleBg }]}>
                {(['incidents', 'rules'] as const).map((key) => {
                    const active = tab === key;
                    return (
                        <TouchableOpacity
                            key={key}
                            style={[styles.tab, active && { backgroundColor: theme.background }]}
                            onPress={() => setTab(key)}
                            activeOpacity={0.8}
                        >
                            <Text style={[styles.tabText, { color: active ? theme.textPrimary : theme.textSecondary }]}>
                                {t(key === 'incidents' ? 'incidents' : 'rules-tab')}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
                {renderGrid()}
            </ScrollView>
        </>
    );

    const renderConfirm = (sel: Selection) => {
        const label = sel.kind === 'incident' ? t(getIncidentTranslationKey(sel.typeName)) : ruleLabel(sel.rule);
        const icon = sel.kind === 'incident' ? renderIncidentIcon(sel.typeName, 52) : renderRuleIcon(sel.rule, 48);

        return (
            <>
                <View style={styles.header}>
                    <Text style={[styles.title, { color: theme.textPrimary }]} numberOfLines={1}>
                        {t('report')}: {label}
                    </Text>
                    <TouchableOpacity onPress={close} hitSlop={12} activeOpacity={0.7}>
                        <Ionicons name="close" size={28} color={theme.textPrimary} />
                    </TouchableOpacity>
                </View>

                <View style={styles.selected}>
                    <View
                        style={[
                            styles.circle,
                            {
                                backgroundColor: sel.kind === 'rule' ? ruleCircleBg : circleBg,
                                borderWidth: 3,
                                borderColor: theme.primary,
                            },
                        ]}
                    >
                        {icon}
                    </View>
                    <View style={[styles.check, { backgroundColor: theme.primary, borderColor: theme.background }]}>
                        <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                    </View>
                </View>

                <TouchableOpacity onPress={openDetails} style={styles.detailsLink} hitSlop={8} activeOpacity={0.7}>
                    <Ionicons name="create-outline" size={18} color={theme.blue} />
                    <Text style={[styles.detailsText, { color: theme.blue }]}>{t('add-details')}</Text>
                </TouchableOpacity>

                <View style={styles.actions}>
                    <TouchableOpacity
                        style={[styles.button, { backgroundColor: circleBg }]}
                        onPress={close}
                        activeOpacity={0.8}
                    >
                        <Text style={[styles.buttonText, { color: theme.textPrimary }]}>{t('cancel')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.button, { backgroundColor: theme.primary, overflow: 'hidden' }]}
                        onPress={() => submit(sel, reportLocation)}
                        activeOpacity={0.8}
                    >
                        <Animated.View style={[styles.progressFill, progressStyle]} />
                        <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>{t('report')}</Text>
                    </TouchableOpacity>
                </View>
            </>
        );
    };

    return (
        <View style={[StyleSheet.absoluteFill, styles.root]} pointerEvents="box-none">
            <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)} style={StyleSheet.absoluteFill}>
                <Pressable style={[StyleSheet.absoluteFill, styles.backdrop]} onPress={close} />
            </Animated.View>

            <Animated.View
                entering={SlideInDown.duration(260)}
                exiting={SlideOutDown.duration(200)}
                style={[
                    styles.sheet,
                    {
                        backgroundColor: theme.background,
                        paddingBottom: insets.bottom + 16,
                        maxHeight: windowHeight * 0.85,
                    },
                ]}
            >
                <View style={styles.handle}>
                    <View style={[styles.handleBar, { backgroundColor: isDark ? theme.border : '#D1D5DB' }]} />
                </View>
                {selection ? renderConfirm(selection) : renderPicker()}
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    root: {
        zIndex: 30,
        elevation: 30,
    },
    backdrop: {
        backgroundColor: 'rgba(0,0,0,0.25)',
    },
    sheet: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 30,
        paddingHorizontal: 16,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 30,
    },
    handle: {
        alignItems: 'center',
        paddingVertical: 10,
    },
    handleBar: {
        width: 48,
        height: 6,
        borderRadius: 3,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    title: {
        flex: 1,
        fontSize: 24,
        fontWeight: '700',
        marginRight: 12,
    },
    tabs: {
        flexDirection: 'row',
        borderRadius: 14,
        padding: 4,
        marginBottom: 16,
    },
    tab: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 10,
        alignItems: 'center',
    },
    tabText: {
        fontSize: 15,
        fontWeight: '600',
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    tile: {
        width: '33.333%',
        alignItems: 'center',
        marginBottom: 18,
        paddingHorizontal: 4,
    },
    circle: {
        width: TILE_CIRCLE,
        height: TILE_CIRCLE,
        borderRadius: TILE_CIRCLE / 2,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    tileLabel: {
        marginTop: 8,
        fontSize: 14,
        fontWeight: '500',
        textAlign: 'center',
    },
    loading: {
        paddingVertical: 48,
        alignItems: 'center',
    },
    selected: {
        alignSelf: 'center',
        marginTop: 4,
    },
    check: {
        position: 'absolute',
        top: 0,
        right: 0,
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    detailsLink: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'center',
        marginTop: 16,
        marginBottom: 20,
    },
    detailsText: {
        marginLeft: 6,
        fontSize: 15,
        fontWeight: '600',
    },
    actions: {
        flexDirection: 'row',
        gap: 12,
    },
    button: {
        flex: 1,
        height: 54,
        borderRadius: 27,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonText: {
        fontSize: 17,
        fontWeight: '700',
    },
    progressFill: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.18)',
    },
});
