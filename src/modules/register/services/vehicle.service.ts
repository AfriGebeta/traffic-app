import { apiService } from '../../../shared/services/api';
import { Vehicle, VehicleRegistrationRequest } from '../types/vehicle.types';

export const vehicleService = {
    async register(data: VehicleRegistrationRequest) {
        return apiService.post<Vehicle>('/api/vehicles', data);
    },
};
