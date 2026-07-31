/**
 for debugging
 */

import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Leg } from '../types/navigation.types';
import { useInstructionEngine } from '../hooks/useInstructionEngine';
import {
    bannerLeadDistance,
    finalTriggerDistance,
    formatDistance,
    maneuverIcon,
} from '../utils/instructionEngine';

interface Props {
    legs?: Leg[] | null;
    userLocation?: { lat: number; lng: number } | null;
    speedKmh?: number;
    visible?: boolean;
    voiceEnabled?: boolean;
    topOffset?: number;
}

export const InstructionTestPanel: React.FC<Props> = ({
    legs,
    userLocation,
    speedKmh = 0,
    visible = true,
    voiceEnabled = false,
    topOffset = 190,
}) => {
    const insets = useSafeAreaInsets();
    const [expanded, setExpanded] = useState(true);

    const { plan, state, lastCue, prefetch } = useInstructionEngine({
        legs,
        userLocation,
        speedKmh,
        voiceEnabled,
    });

    if (!visible || !plan || !state) return null;

    const speed = Math.max(0, speedKmh) / 3.6;
    const icon = maneuverIcon(state.primaryManeuverType) as keyof typeof Ionicons.glyphMap;
    const stepLabel = `${(state.upcomingStep?.index ?? state.currentStep.index) + 1}/${plan.steps.length}`;

    return (
        <View style={[styles.wrapper, { top: insets.top + topOffset }]} pointerEvents="box-none">
            <Pressable style={styles.card} onPress={() => setExpanded((v) => !v)}>
                <View style={styles.headerRow}>
                    <Text style={styles.tag}>ENGINE DEBUG</Text>
                    {voiceEnabled && <Text style={styles.tag}>VOICE</Text>}
                </View>

                <View style={styles.bannerRow}>
                    <Ionicons name={icon} size={34} color="#FFFFFF" style={styles.icon} />
                    <View style={styles.bannerText}>
                        {!!state.distanceText && <Text style={styles.distance}>{state.distanceText}</Text>}
                        <Text style={styles.primary} numberOfLines={3}>{state.primaryText}</Text>
                    </View>
                </View>

                {!!state.thenText && (
                    <View style={styles.thenRow}>
                        <Ionicons
                            name={maneuverIcon(state.thenStep?.type ?? 0) as keyof typeof Ionicons.glyphMap}
                            size={12}
                            color="#7CE38B"
                        />
                        <Text style={styles.then} numberOfLines={1}>
                            then {state.thenText.toLowerCase()}
                        </Text>
                    </View>
                )}

                {expanded && (
                    <View style={styles.debug}>
                        <Row label="step" value={stepLabel} />
                        <Row label="to maneuver" value={`${Math.round(state.distanceToManeuver)} m`} />
                        <Row
                            label="remaining"
                            value={`${formatDistance(state.distanceRemaining)} · ${Math.round(state.timeRemaining / 60)} min`}
                        />
                        <Row label="along" value={`${Math.round(state.alongDistance)} m`} />
                        <Row
                            label="off route"
                            value={`${Math.round(state.offsetDistance)} m${state.isOffRoute ? ' ⚠︎' : ''}`}
                        />
                        <Row label="speed" value={`${speedKmh.toFixed(0)} km/h`} />
                        <Row label="cue at" value={`${Math.round(finalTriggerDistance(speed))} m`} />
                        <Row label="text at" value={`${Math.round(bannerLeadDistance(speed))} m`} />
                        <Row
                            label="audio ready"
                            value={prefetch.total ? `${prefetch.done}/${prefetch.total}` : '—'}
                        />
                        <Row label="current" value={state.currentStep.instruction} />
                        <Row label="last cue" value={lastCue ? `[${lastCue.tier}] ${lastCue.text}` : '—'} />
                    </View>
                )}
            </Pressable>
        </View>
    );
};

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <View style={styles.row}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue} numberOfLines={2}>{value}</Text>
    </View>
);

const styles = StyleSheet.create({
    wrapper: {
        position: 'absolute',
        left: 8,
        right: 8,
        zIndex: 9999,
    },
    card: {
        backgroundColor: 'rgba(12,12,14,0.92)',
        borderRadius: 14,
        padding: 12,
        borderWidth: 1,
        borderColor: '#2B2B31',
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    tag: {
        color: '#7CE38B',
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 1,
    },
    bannerRow: { flexDirection: 'row', alignItems: 'center' },
    icon: { marginRight: 12 },
    bannerText: { flex: 1 },
    distance: { color: '#7CE38B', fontSize: 16, fontWeight: '700', marginBottom: 2 },
    primary: { color: '#FFFFFF', fontSize: 26, fontWeight: '700', lineHeight: 31 },
    thenRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
    then: { color: '#7CE38B', fontSize: 12, flex: 1 },
    debug: {
        marginTop: 10,
        paddingTop: 8,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: '#33333A',
        gap: 2,
    },
    row: { flexDirection: 'row', alignItems: 'flex-start' },
    rowLabel: { color: '#71717A', fontSize: 10, width: 82 },
    rowValue: { color: '#D4D4D8', fontSize: 10, flex: 1 },
});

export default InstructionTestPanel;
