export interface TelegramAuthPayload {
    id: string;
    auth_date: string;
    hash: string;
    first_name: string;
    username?: string;
    photo_url?: string;
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
