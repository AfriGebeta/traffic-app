export interface User {
    id: string;
    phoneNumber: string;
    name: string;
    username?: string;
    profileImage?: string | null;
    profileImageLocal?: string | null;
    password?: string;
    points: number;
    role?: string;
    isBanned?: boolean;
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

export interface UpdateProfileRequest {
    name?: string;
    profileImage?: string | null;
}

export interface UserLoginRequest {
    phoneNumber: string;
    password: string;
}
