import { apiService } from '../../../shared/services/api';
import { AuthResponse, UserRegistrationRequest, UserLoginRequest } from '../types/user.types';

export const userService = {
    async register(data: UserRegistrationRequest) {
        return apiService.post<AuthResponse>('/api/users/register', data);
    },

    async login(data: UserLoginRequest) {
        return apiService.post<AuthResponse>('/api/users/login', data);
    },
};
