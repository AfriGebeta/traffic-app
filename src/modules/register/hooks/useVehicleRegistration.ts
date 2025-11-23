import { useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { vehicleService } from '../services/vehicle.service';
import { Vehicle, VehicleRegistrationRequest } from '../types/vehicle.types';

const VEHICLE_STORAGE_KEY = '@traffic_app_vehicle';

export const useVehicleRegistration = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const register = async (data: VehicleRegistrationRequest): Promise<Vehicle | null> => {
        setLoading(true);
        setError(null);

        try {
            const response = await vehicleService.register(data);

            if (response.error) {
                setError(response.error);
                return null;
            }

            if (response.data) {
                await AsyncStorage.setItem(VEHICLE_STORAGE_KEY, JSON.stringify(response.data));
                return response.data;
            }

            return null;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Registration failed';
            setError(errorMessage);
            return null;
        } finally {
            setLoading(false);
        }
    };

    const getStoredVehicle = async (): Promise<Vehicle | null> => {
        try {
            const stored = await AsyncStorage.getItem(VEHICLE_STORAGE_KEY);
            return stored ? JSON.parse(stored) : null;
        } catch {
            return null;
        }
    };

    const clearVehicle = async (): Promise<void> => {
        await AsyncStorage.removeItem(VEHICLE_STORAGE_KEY);
    };

    return {
        register,
        getStoredVehicle,
        clearVehicle,
        loading,
        error,
    };
};
