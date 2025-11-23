import React, { useState } from 'react';
import { View, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { PlateNumberStep } from '../components/PlateNumberStep';
import { CarModelStep } from '../components/CarModelStep';
import { useVehicleRegistration } from '../hooks/useVehicleRegistration';

export default function RegistrationScreen() {
    const router = useRouter();
    const [step, setStep] = useState<'plate' | 'model'>('plate');
    const [plate, setPlate] = useState('');
    const { register, loading, error } = useVehicleRegistration();

    const handlePlateNext = (plateNumber: string) => {
        setPlate(plateNumber);
        setStep('model');
    };

    const handleBack = () => {
        setStep('plate');
    };

    const handleSubmit = async (model: string) => {
        const vehicle = await register({ plate, model });

        if (vehicle) {
            Alert.alert('Success', 'Vehicle registered successfully!', [
                {
                    text: 'OK',
                    onPress: () => router.replace('/'),
                },
            ]);
        } else if (error) {
            Alert.alert('Error', error);
        }
    };

    return (
        <View className="flex-1 bg-white">
            {step === 'plate' ? (
                <PlateNumberStep onNext={handlePlateNext} />
            ) : (
                <CarModelStep
                    plate={plate}
                    onBack={handleBack}
                    onSubmit={handleSubmit}
                    loading={loading}
                />
            )}
        </View>
    );
}
