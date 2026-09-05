import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { navigationService } from '../../navigation/services/navigation.service';
import type { JourneyPrompt } from '../../navigation/utils/taxiJourney';
import TaxiDarkIcon from '../../../../assets/images/contribute-taxi-dark.svg';

const GREEN = '#0F9D58';
type Place = { name: string; lat: number; lng: number };
interface Props {
    prompt: JourneyPrompt | null;
    isOnTaxi: boolean;
    boardingTarget: string;
    targetName: string;
    hasLocation: boolean;
    canUndo: boolean;
    busy: boolean;
    error: string | null;
    onRequest: () => void;
    onConfirm: () => void;
    onDismiss: () => void;
    onUndo: () => void;
    onDifferentDropoff: (place: Place) => Promise<void>;
}

export default function TaxiJourneyCard({ prompt, isOnTaxi, boardingTarget, targetName,
    hasLocation, canUndo, busy, error, onRequest, onConfirm, onDismiss, onUndo, onDifferentDropoff }: Props) {
    const { colors: theme } = useTheme();
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const [sheet, setSheet] = useState<'options' | 'search' | null>(null);
    const [query, setQuery] = useState('');
    const [places, setPlaces] = useState<Place[]>([]);
    const [searching, setSearching] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);
    const searchId = useRef(0);
    useEffect(() => {
        if (!prompt) { setSheet(null); setQuery(''); setPlaces([]); setSearching(false); setSearchError(null); }
        return () => { searchId.current += 1; };
    }, [prompt]);
    const closeSheet = () => {
        if (busy) return;
        searchId.current += 1;
        setSheet(null);
        onDismiss();
    };
    const search = async () => {
        if (!query.trim()) return;
        const id = ++searchId.current;
        setSearching(true);
        setSearchError(null);
        try {
            const results = await navigationService.geocodePlace(query.trim());
            if (id !== searchId.current) return;
            const options = results.filter(place => Number.isFinite(place.latitude) && Number.isFinite(place.longitude))
                .slice(0, 6).map(place => ({ name: place.display_name || place.name, lat: place.latitude, lng: place.longitude }));
            setPlaces(options);
            if (!options.length) setSearchError(t('taxi-journey-no-places'));
        } catch {
            if (id === searchId.current) setSearchError(t('taxi-journey-search-failed'));
        } finally {
            if (id === searchId.current) setSearching(false);
        }
    };
    const button = (label: string, onPress: () => void, primary = false, disabled = false) => (
        <TouchableOpacity accessibilityRole="button" onPress={onPress} disabled={busy || disabled}
            style={{ minHeight: 48, justifyContent: 'center', backgroundColor: primary ? '#FFB300' : theme.surface,
                borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, opacity: busy || disabled ? 0.5 : 1 }}>
            <Text style={{ color: primary ? '#302100' : theme.textPrimary, fontSize: 15, fontWeight: '700', textAlign: 'center' }}>{label}</Text>
        </TouchableOpacity>
    );
    const routeQuestion = prompt?.reason === 'route';
    const question = isOnTaxi ? routeQuestion ? t('taxi-journey-still-going', { target: targetName })
        : prompt?.reason === 'near' ? t('taxi-journey-off-at', { target: targetName }) : t('taxi-journey-got-off-question')
        : t('taxi-journey-on-taxi', { target: boardingTarget });
    return (
        <View style={{ marginTop: 8 }}>
            {prompt && !sheet && <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0,
                zIndex: 10, elevation: 8, padding: 12, borderRadius: 20, backgroundColor: theme.background,
                shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.14, shadowRadius: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                    <Text accessibilityRole="header" accessibilityLiveRegion="polite"
                        style={{ flex: 1, color: theme.textPrimary, fontSize: 17,
                            lineHeight: 23, fontWeight: '700' }}>{question}</Text>
                    <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('taxi-journey-dismiss')}
                        onPress={onDismiss} disabled={busy}
                        style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="close" size={20} color={theme.textSecondary} />
                    </TouchableOpacity>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                    <View style={{ flex: 1 }}>{button(routeQuestion ? t('taxi-journey-yes-riding') : isOnTaxi ? t('taxi-journey-yes-off') : t('taxi-journey-yes-boarded'),
                        routeQuestion ? onDismiss : onConfirm, true, !routeQuestion && !hasLocation)}</View>
                    <View style={{ flex: 1 }}>{button(routeQuestion ? t('taxi-journey-i-got-off') : isOnTaxi ? t('taxi-journey-still-riding') : t('taxi-journey-not-yet'),
                        routeQuestion ? onConfirm : onDismiss, false, routeQuestion && !hasLocation)}</View>
                </View>
            </View>}
            <View pointerEvents={prompt && !sheet ? 'none' : 'auto'}
                accessibilityElementsHidden={!!prompt && !sheet}
                importantForAccessibility={prompt && !sheet ? 'no-hide-descendants' : 'auto'}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8, opacity: prompt && !sheet ? 0 : 1 }}>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel={isOnTaxi ? t('taxi-journey-confirm-off') : t('taxi-journey-confirm-board')}
                    onPress={onRequest} disabled={busy}
                    style={{ flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                        borderRadius: 8, backgroundColor: GREEN, gap: 8, paddingHorizontal: 16 }}>
                    <TaxiDarkIcon width={24} height={24} />
                    <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{isOnTaxi ? t('taxi-journey-off-short') : t('taxi-journey-board-short')}</Text>
                </TouchableOpacity>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('taxi-journey-options')} disabled={busy}
                    onPress={() => { onRequest(); setSheet('options'); }}
                    style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="ellipsis-horizontal" size={22} color={theme.textPrimary} />
                </TouchableOpacity>
            </View>
            {!hasLocation && <Text style={{ color: theme.textSecondary, fontSize: 12 }}>{t('taxi-journey-waiting-location')}</Text>}
            <Modal visible={sheet !== null} transparent animationType="slide" onRequestClose={closeSheet}>
                <KeyboardAvoidingView style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.3)' }}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                    <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('taxi-journey-close-options')} style={{ flex: 1 }} onPress={closeSheet} />
                    <View style={{ maxHeight: '65%', backgroundColor: theme.background, borderTopLeftRadius: 24,
                        borderTopRightRadius: 24, padding: 20, paddingBottom: insets.bottom + 16 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                            <Text accessibilityRole="header" style={{ flex: 1, color: theme.textPrimary, fontSize: 20, fontWeight: '700' }}>
                                {sheet === 'search' ? t('taxi-journey-change-dropoff') : t('taxi-journey-options')}
                            </Text>
                            <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('taxi-journey-close-options')} onPress={closeSheet} disabled={busy}
                                style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                                <Ionicons name="close" size={22} color={theme.textPrimary} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 10 }}>
                            {sheet === 'options' ? <>
                                {button(isOnTaxi ? t('taxi-journey-off-this-taxi') : t('taxi-journey-boarded-toward', { target: boardingTarget }), onConfirm, true, !hasLocation)}
                                {button(isOnTaxi ? t('taxi-journey-change-dropoff') : t('taxi-journey-elsewhere'), () => setSheet('search'))}
                                {canUndo && button(t('taxi-journey-undo'), onUndo)}
                            </> : <>
                                <Text style={{ color: theme.textSecondary }}>{t('taxi-journey-dropoff-help')}</Text>
                                <TextInput value={query} onChangeText={value => { searchId.current += 1; setSearching(false); setPlaces([]); setQuery(value); }}
                                    placeholder={t('taxi-journey-station')} placeholderTextColor={theme.textSecondary} editable={!busy}
                                    returnKeyType="search" onSubmitEditing={search} accessibilityLabel={t('taxi-journey-dropoff-label')}
                                    style={{ color: theme.textPrimary, borderColor: theme.border, borderWidth: 1, borderRadius: 10, padding: 12 }} />
                                {button(searching ? t('taxi-journey-searching') : t('taxi-journey-search'), search, true, searching || !query.trim())}
                                {places.map((place, index) => <View key={`${place.lat}-${place.lng}-${index}`}>
                                    {button(place.name, () => { void onDifferentDropoff(place); }, false, !hasLocation)}
                                </View>)}
                                {searchError && <Text style={{ color: theme.textSecondary }}>{searchError}</Text>}
                                {button(t('taxi-journey-back'), () => { searchId.current += 1; setSearching(false); setSheet('options'); })}
                            </>}
                            {busy && <ActivityIndicator color={GREEN} />}
                            {error && <Text style={{ color: theme.textSecondary }}>{error}</Text>}
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
}
