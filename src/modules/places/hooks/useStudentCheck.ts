import { useEffect, useState } from 'react';
import { getAccessToken, onSessionExpired, onSessionStarted } from '../../../shared/services/auth-session';
import { businessService } from '../services/business.service';
import { StudentCheck } from '../types/business.types';

interface State {
    check: StudentCheck | null;
    loaded: boolean;
}

let state: State = { check: null, loaded: false };
let inFlight: Promise<void> | null = null;
let subscribed = false;
const listeners = new Set<(next: State) => void>();

const set = (next: State) => {
    state = next;
    listeners.forEach((listener) => listener(next));
};

export const refreshStudentCheck = (): Promise<void> => {
    if (inFlight) return inFlight;
    inFlight = (async () => {
        try {
            if (!(await getAccessToken())) {
                set({ check: null, loaded: true });
                return;
            }
            set({ check: await businessService.studentCheck(), loaded: true });
        } catch {
            set({ ...state, loaded: true });
        } finally {
            inFlight = null;
        }
    })();
    return inFlight;
};

export const resetStudentCheck = () => set({ check: null, loaded: false });

export const setStudentCheck = (check: StudentCheck | null) => set({ check, loaded: true });

export const isVerifiedStudent = (check: StudentCheck | null): boolean => {
    if (!check || check.kind !== 'student' || check.status !== 'APPROVED') return false;
    const until = check.validUntil ? new Date(check.validUntil).getTime() : NaN;
    return Number.isNaN(until) || until > Date.now();
};

const subscribeSession = () => {
    if (subscribed) return;
    subscribed = true;
    onSessionStarted(() => void refreshStudentCheck());
    onSessionExpired(() => set({ check: null, loaded: true }));
};

export function useStudentCheck() {
    const [value, setValue] = useState(state);
    useEffect(() => {
        subscribeSession();
        listeners.add(setValue);
        setValue(state);
        if (!state.loaded) void refreshStudentCheck();
        return () => {
            listeners.delete(setValue);
        };
    }, []);
    return { ...value, verified: isVerifiedStudent(value.check), refresh: refreshStudentCheck };
}
