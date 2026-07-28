import { apiService } from '../../../shared/services/api';
import { AuthResponse, UserRegistrationRequest, UserLoginRequest, UpdateProfileRequest, User } from '../types/user.types';

export const userService = {
    async register(data: UserRegistrationRequest) {
        return apiService.post<AuthResponse>('/api/users/register', data);
    },

    async login(data: UserLoginRequest) {
        return apiService.post<AuthResponse>('/api/users/login', data);
    },

    async getProfile() {
        return apiService.get<User>('/api/users/profile');
    },

    async updateProfile(userId: string, data: UpdateProfileRequest) {
        return apiService.patch<User | { user: User }>(`/api/users/profile/${userId}`, data);
    },
};
