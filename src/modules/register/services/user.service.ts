import { apiService } from '../../../shared/services/api';
import { AuthResponse, UserRegistrationRequest } from '../types/user.types';

export const userService = {
    async register(data: UserRegistrationRequest) {
        return apiService.post<AuthResponse>('/api/users/auth', data);
    },
};
