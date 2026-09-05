import { useEffect, useRef, useState } from 'react';
import { paymentService } from '../services/payment.service';
import { DriverLookupResponse } from '../types/payment.types';

const LOOKUP_DEBOUNCE_MS = 500;
const MIN_CODE_LENGTH = 3;

export type DriverLookupStatus = 'idle' | 'loading' | 'found' | 'error';

export function useDriverLookup(driverCode: string, onResolved: (phoneNumber: string) => void) {
    const [status, setStatus] = useState<DriverLookupStatus>('idle');
    const [driver, setDriver] = useState<DriverLookupResponse | null>(null);

    const onResolvedRef = useRef(onResolved);
    onResolvedRef.current = onResolved;

    useEffect(() => {
        const code = driverCode.trim();

        if (code.length < MIN_CODE_LENGTH) {
            setStatus('idle');
            setDriver(null);
            return;
        }

        let cancelled = false;
        setStatus('loading');

        const timer = setTimeout(() => {
            paymentService.getDriver(code)
                .then((result) => {
                    if (cancelled) return;
                    setDriver(result);
                    setStatus('found');
                    if (result.phoneNumber) onResolvedRef.current(result.phoneNumber);
                })
                .catch(() => {
                    if (cancelled) return;
                    setDriver(null);
                    setStatus('error');
                });
        }, LOOKUP_DEBOUNCE_MS);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [driverCode]);

    return { status, driver };
}
