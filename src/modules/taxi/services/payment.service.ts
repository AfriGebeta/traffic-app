import { apiService } from '../../../shared/services/api';
import { PaymentInitiateRequest, PaymentInitiateResponse, PaymentSaleResponse } from '../types/payment.types';

export const paymentService = {
    async initiatePayment(data: PaymentInitiateRequest): Promise<PaymentInitiateResponse> {
        const response = await apiService.post<PaymentInitiateResponse>(
            '/api/payment/initiate',
            data
        );

        if (response.error || !response.data) {
            throw new Error(response.error || 'Failed to initiate payment');
        }

        return response.data;
    },

    async getSaleStatus(saleId: number | string): Promise<PaymentSaleResponse> {
        const response = await apiService.get<PaymentSaleResponse>(
            `/api/payment/sales/${saleId}`
        );

        if (response.error || !response.data) {
            throw new Error(response.error || 'Failed to fetch payment status');
        }

        return response.data;
    },
};
