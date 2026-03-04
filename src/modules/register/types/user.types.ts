export interface User {
    id: string;
    phoneNumber: string;
    name: string;
    password?: string;
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
    password: string;
    name: string;
}

export interface UserLoginRequest {
    phoneNumber: string;
    password: string;
}
