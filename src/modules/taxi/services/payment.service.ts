import { apiService } from '../../../shared/services/api';
import {
    DriverLookupResponse,
    PaymentInitiateRequest,
    PaymentInitiateResponse,
    PaymentSaleResponse,
    PaymentSalesPage,
    PaymentSalesQuery,
} from '../types/payment.types';

const API_URL = process.env.EXPO_PUBLIC_API_URL!;

const asRecord = (value: unknown): Record<string, unknown> | null =>
    value !== null && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : null;

const asNumber = (value: unknown): number | undefined => {
    const number = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(number) ? number : undefined;
};

const parseSalesPage = (payload: unknown, query: Required<Pick<PaymentSalesQuery, 'limit' | 'offset'>>): PaymentSalesPage => {
    if (Array.isArray(payload)) {
        return {
            sales: payload as PaymentSaleResponse[],
            limit: query.limit,
            offset: query.offset,
            hasMore: payload.length === query.limit,
        };
    }

    const root = asRecord(payload) ?? {};
    const nestedData = asRecord(root.data);
    const body = nestedData ?? root;
    const pagination = asRecord(body.pagination) ?? asRecord(root.pagination) ?? asRecord(body.meta) ?? {};

    const salesCandidate = body.sales ?? body.items ?? body.results ?? (Array.isArray(root.data) ? root.data : []);
    const sales = Array.isArray(salesCandidate) ? salesCandidate as PaymentSaleResponse[] : [];
    const total = asNumber(body.total ?? body.count ?? pagination.total ?? pagination.count);
    const limit = asNumber(body.limit ?? pagination.limit) ?? query.limit;
    const offset = asNumber(body.offset ?? pagination.offset) ?? query.offset;
    const explicitHasMore = body.hasMore ?? pagination.hasMore;

    return {
        sales,
        total,
        limit,
        offset,
        hasMore: typeof explicitHasMore === 'boolean'
            ? explicitHasMore
            : total !== undefined
                ? offset + sales.length < total
                : sales.length === limit,
    };
};

export const paymentService = {
    getReceiptUrl(saleId: number | string): string {
        return `${API_URL}/api/payment/receipt/${encodeURIComponent(String(saleId))}`;
    },

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

    async getDriver(driverCode: string): Promise<DriverLookupResponse> {
        const response = await apiService.get<DriverLookupResponse>(
            `/api/payment/drivers/${encodeURIComponent(driverCode)}`
        );

        if (response.error || !response.data) {
            throw new Error(response.error || 'Driver not found');
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

    async getSales(query: PaymentSalesQuery = {}): Promise<PaymentSalesPage> {
        const limit = query.limit ?? 25;
        const offset = query.offset ?? 0;
        const params = [
            `limit=${encodeURIComponent(limit)}`,
            `offset=${encodeURIComponent(offset)}`,
            ...(query.status ? [`status=${encodeURIComponent(query.status)}`] : []),
        ].join('&');
        const response = await apiService.get<unknown>(`/api/payment/sales?${params}`);

        if (response.error || response.data === undefined) {
            throw new Error(response.error || 'Failed to fetch payment transactions');
        }

        return parseSalesPage(response.data, { limit, offset });
    },
};
