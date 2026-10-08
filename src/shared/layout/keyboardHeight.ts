import { useSyncExternalStore } from 'react';
import { Keyboard } from 'react-native';

let keyboardHeight = 0;
const subscribers = new Set<() => void>();
let listening = false;

function set(next: number) {
    if (next === keyboardHeight) return;
    keyboardHeight = next;
    subscribers.forEach((notify) => notify());
}

function subscribe(notify: () => void) {
    subscribers.add(notify);
    if (!listening) {
        listening = true;
        Keyboard.addListener('keyboardDidShow', (event) => set(event.endCoordinates.height));
        Keyboard.addListener('keyboardDidHide', () => set(0));
    }
    return () => {
        subscribers.delete(notify);
    };
}

export function useKeyboardHeight(): number {
    return useSyncExternalStore(subscribe, () => keyboardHeight);
}
