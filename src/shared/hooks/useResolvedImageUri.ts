import { useEffect, useState } from 'react';
import { resolveImageUri } from '../utils/image';


export const useResolvedImageUri = (value?: string | null): string | null => {
    const [uri, setUri] = useState<string | null>(null);

    useEffect(() => {
        let active = true;

        if (!value) {
            setUri(null);
            return;
        }

        resolveImageUri(value)
            .then((resolved) => {
                if (active) setUri(resolved);
            })
            .catch(() => {
                if (active) setUri(null);
            });

        return () => {
            active = false;
        };
    }, [value]);

    return uri;
};
