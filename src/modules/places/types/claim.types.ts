export type VerificationMethod = 'TRADE_LICENSE' | 'TIN_CERTIFICATE';

export interface ClaimBusinessRequest {
    verificationMethod: VerificationMethod;
    documentKey: string;
    tinNumber?: string;
}

export interface ClaimBusinessResponse {
    id: string;
    placeId: string;
    userId: string;
    verificationMethod: VerificationMethod;
    documentKey: string;
    tinNumber?: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    createdAt: string;
    updatedAt: string;
}
