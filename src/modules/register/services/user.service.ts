import { apiService } from '../../../shared/services/api';
import {
    AuthResponse,
    UserRegistrationRequest,
    UserLoginRequest,
    UpdateProfileRequest,
    User,
    RegistrationResponse,
    VerifyEmailRequest,
    ResendVerificationRequest,
    SubmitEmailRequest,
    SubmitEmailResponse,
} from '../types/user.types';

export const userService = {
    async register(data: UserRegistrationRequest) {
        return apiService.post<RegistrationResponse>('/api/users/register', data);
    },

    async login(data: UserLoginRequest) {
        return apiService.post<AuthResponse>('/api/users/login', data);
    },

    async verifyEmail(data: VerifyEmailRequest) {
        return apiService.post<AuthResponse>('/api/users/verify-email', data);
    },

    async resendVerification(data: ResendVerificationRequest) {
        return apiService.post<{ message: string }>('/api/users/resend-verification', data);
    },

    async submitEmail(data: SubmitEmailRequest) {
        return apiService.post<SubmitEmailResponse>('/api/users/submit-email', data);
    },

    async getProfile() {
        return apiService.get<User>('/api/users/profile');
    },

    async updateProfile(userId: string, data: UpdateProfileRequest) {
        return apiService.patch<User | { user: User }>(`/api/users/profile/${userId}`, data);
    },
};
