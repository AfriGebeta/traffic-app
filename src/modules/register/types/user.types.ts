export interface User {
    id: string;
    phoneNumber: string;
    name: string;
    email?: string;
    isEmailVerified?: boolean;
    username?: string;
    profileImage?: string | null;
    profileImageLocal?: string | null;
    sex?: number | null;
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
    email: string;
}

export interface RegistrationResponse {
    message: string;
    userId: string;
}

export interface VerifyEmailRequest {
    userId: string;
    code: string;
}

export interface ResendVerificationRequest {
    userId: string;
}

export interface SubmitEmailRequest {
    phoneNumber: string;
    email: string;
}

export interface SubmitEmailResponse {
    userId: string;
    message: string;
}

export interface UpdateProfileRequest {
    name?: string;
    phoneNumber?: string;
    sex?: number;
    profileImage?: string | null;
}

export interface UserLoginRequest {
    phoneNumber: string;
    password: string;
}
