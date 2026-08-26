import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { paymentService } from '../services/payment.service';
import { PaymentInitiateRequest, PaymentSaleStatus } from '../types/payment.types';

const POLL_INTERVAL_MS = 3000;
const POLL_MAX_ATTEMPTS = 40; // ~2 min

export type PaymentStage = 'idle' | 'confirming' | 'success' | 'failed';

export function useLekfelPayment() {
    const { t } = useTranslation();

    const [stage, setStage] = useState<PaymentStage>('idle');
    const [errorMessage, setErrorMessage] = useState('');

    const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
    const pollAttempts = useRef(0);

    const stopPolling = () => {
        if (pollTimer.current) {
            clearInterval(pollTimer.current);
            pollTimer.current = null;
        }
    };

    useEffect(() => stopPolling, []);

    const handleStatus = (status: PaymentSaleStatus) => {
        if (status === 'COMPLETED') {
            stopPolling();
            setStage('success');
            return;
        }
        if (status === 'FAILED' || status === 'EXPIRED') {
            stopPolling();
            setErrorMessage(status === 'EXPIRED' ? t('payment-expired') : t('payment-failed'));
            setStage('failed');
        }
    };

    const startPolling = (saleId: number | string) => {
        pollAttempts.current = 0;
        pollTimer.current = setInterval(async () => {
            pollAttempts.current += 1;
            try {
                const sale = await paymentService.getSaleStatus(saleId);
                handleStatus(sale.status);
            } catch {
                // transient network error, keep polling
            }
            if (pollAttempts.current >= POLL_MAX_ATTEMPTS) {
                stopPolling();
                setErrorMessage(t('payment-failed'));
                setStage('failed');
            }
        }, POLL_INTERVAL_MS);
    };

    const pay = async (request: Omit<PaymentInitiateRequest, 'reference'>) => {
        setErrorMessage('');
        setStage('confirming');

        const reference = `trip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        try {
            const result = await paymentService.initiatePayment({ ...request, reference });
            startPolling(result.sale.id);
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : t('payment-failed'));
            setStage('failed');
        }
    };

    const reset = () => {
        stopPolling();
        setErrorMessage('');
        setStage('idle');
    };

    return { stage, errorMessage, pay, reset };
}
