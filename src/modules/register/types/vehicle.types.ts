export interface Vehicle {
    id: string;
    plate: string;
    model: string;
    color: string | null;
    deviceId: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface VehicleRegistrationRequest {
    plate: string;
    model: string;
}

export const REGION_CODES = ['ET', 'AA', 'AF', 'AM', 'BG', 'DR', 'GM', 'HR', 'OR', 'SM', 'UN', 'AU'] as const;

export type RegionCode = typeof REGION_CODES[number];

export const CAR_MODELS = [
    'Toyota',
    'Suzuki',
    'BMW',
    'Mercedes-Benz',
    'BYD',
    'Honda',
    'Hyundai',
    'Nissan',
    'Mazda',
    'Volkswagen',
    'Ford',
    'Other',
] as const;

export type CarModel = typeof CAR_MODELS[number];
