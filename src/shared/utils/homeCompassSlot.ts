import { useSyncExternalStore } from 'react';

export interface HomeCompassSlot {
    top: number;
    right: number;
}

let slot: HomeCompassSlot | null = null;
const listeners = new Set<() => void>();

export const setHomeCompassSlot = (next: HomeCompassSlot) => {
    const rounded = { top: Math.round(next.top), right: Math.round(next.right) };
    if (slot && slot.top === rounded.top && slot.right === rounded.right) return;
    slot = rounded;
    listeners.forEach((listener) => listener());
};

export const useHomeCompassSlot = () =>
    useSyncExternalStore(
        (listener) => {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
        () => slot
    );
