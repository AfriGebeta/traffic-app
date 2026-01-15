export interface User {
    id: string;
    phoneNumber: string;
    name: string;
    points: number;
    createdAt: string;
    updatedAt: string;
}

export interface AuthResponse {
    user: User;
    token: string;
}

export interface UserRegistrationRequest {
    phoneNumber: string;
    name: string;
    deviceId: string;
}
