type Listener = (message: string) => void;

const listeners = new Set<Listener>();

export const subscribeToast = (listener: Listener) => {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
};

export const showToast = (message: string) => {
    listeners.forEach((listener) => listener(message));
};
