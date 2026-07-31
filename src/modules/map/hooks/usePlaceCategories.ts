import { useEffect, useState } from 'react';
import {
    categoriesService,
    FALLBACK_CATEGORIES,
    type PlaceCategory,
} from '../services/categoriesService';

export const usePlaceCategories = () => {
    const [categories, setCategories] = useState<PlaceCategory[]>(FALLBACK_CATEGORIES);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let mounted = true;

        (async () => {
            const cached = await categoriesService.getCached();
            if (mounted && cached) {
                setCategories(cached);
            }

            const fresh = await categoriesService.fetchCategories();
            if (mounted) {
                setCategories(fresh);
                setIsLoading(false);
            }
        })();

        return () => {
            mounted = false;
        };
    }, []);

    return { categories, isLoading };
};
