import { useEffect, useState } from 'react';
import { getAccessToken, onSessionExpired, onSessionStarted } from '../../../shared/services/auth-session';
import { userService } from '../../register/services/user.service';
import { User } from '../../register/types/user.types';

// in memory only: read from the profile at app start and after each login, never saved to storage
let isCollector = false;
const listeners = new Set<(value: boolean) => void>();
let started = false;

const set = (value: boolean) => {
    if (value === isCollector) return;
    isCollector = value;
    listeners.forEach((listener) => listener(value));
};

const fromUser = (user: (User & { user?: User }) | undefined | null): boolean => {
    const u = user?.user ?? user;
    return u?.isDataCollector === true || u?.role === 'DATA_COLLECTOR';
};

export const refreshDataCollector = async (): Promise<void> => {
    if (!(await getAccessToken())) {
        set(false);
        return;
    }
    try {
        const response = await userService.getProfile();
        if (!response.data) return;
        // TEMP: confirm the collector flag on the phone
        console.log(`[collector] isDataCollector=${(response.data as any)?.isDataCollector} role=${(response.data as any)?.role}`);
        set(fromUser(response.data as any));
    } catch {
        // keep the last value; the next login or app start tries again
    }
};

// logout: back to a normal user
export const resetDataCollector = () => set(false);

// once, from the root layout
export const initDataCollector = () => {
    if (started) return;
    started = true;
    onSessionStarted(() => void refreshDataCollector());
    onSessionExpired(resetDataCollector);
    void refreshDataCollector();
};

export function useIsDataCollector(): boolean {
    const [value, setValue] = useState(isCollector);
    useEffect(() => {
        setValue(isCollector);
        listeners.add(setValue);
        return () => {
            listeners.delete(setValue);
        };
    }, []);
    return value;
}
