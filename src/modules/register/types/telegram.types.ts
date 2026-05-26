export interface TelegramAuthPayload {
    id_token: string;
}

export interface TelegramAuthResponse {
    user: {
        id: string;
        phoneNumber?: string;
        name: string;
        points: number;
        createdAt: string;
        updatedAt: string;
    };
    token: string;
}
