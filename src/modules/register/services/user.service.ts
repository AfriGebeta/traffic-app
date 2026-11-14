import { apiService } from '../../../shared/services/api';
import { withDeviceId } from '../utils/withDeviceId';
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
        return apiService.post<RegistrationResponse>('/api/users/register', await withDeviceId(data, 'register'));
    },

    async login(data: UserLoginRequest) {
        return apiService.post<AuthResponse>('/api/users/login', await withDeviceId(data, 'login'));
    },

    async verifyEmail(data: VerifyEmailRequest) {
        return apiService.post<AuthResponse>('/api/users/verify-email', await withDeviceId(data, 'verify-email'));
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
