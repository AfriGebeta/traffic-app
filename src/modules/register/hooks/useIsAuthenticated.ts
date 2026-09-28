import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { isAuthenticated } from '../utils/authGate';

export const useIsAuthenticated = () => {
    const [isAuthed, setIsAuthed] = useState<boolean | null>(null);

    const refresh = useCallback(() => {
        isAuthenticated().then(setIsAuthed);
    }, []);

    useFocusEffect(refresh);

    return { isAuthed, refresh };
};
