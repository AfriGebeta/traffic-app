export interface TelegramAuthPayload {
    id_token: string;
}

export interface TelegramAuthResponse {
    user: {
        id: string;
        phoneNumber?: string;
        name: string;
        username?: string;
        profileImage?: string | null;
        points: number;
        createdAt: string;
        updatedAt: string;
    };
    token: string;
}
