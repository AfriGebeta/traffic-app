export interface PaymentInitiateRequest {
    payerPhone: string;
    receiverPhone?: string;
    amount: number;
    reference: string;
    description?: string;
    originName?: string;
    originLat?: number;
    originLng?: number;
    destinationName?: string;
    destinationLat?: number;
    destinationLng?: number;
    taxiRouteIds?: number[];
    quotedFare?: number;
    pricingSource?: string;
    tripDayOfWeek?: number;
    tripMinutesOfDay?: number;
}

export interface PaymentInitiateResponse {
    sale: { id: number | string };
    transfer: { id: number | string };
}

export interface DriverLookupResponse {
    driverCode: string;
    fullName: string;
    phoneNumber: string;
}

export type PaymentSaleStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'EXPIRED';

export interface PaymentSaleResponse {
    id: number | string;
    status: PaymentSaleStatus;
    telebirrTransactionId?: string;
    [key: string]: unknown;
}
