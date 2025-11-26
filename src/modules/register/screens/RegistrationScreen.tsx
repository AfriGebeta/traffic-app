import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { PlateNumberStep } from '../components/PlateNumberStep';
import { CarModelStep } from '../components/CarModelStep';
import { useVehicleRegistration } from '../hooks/useVehicleRegistration';
import { showToast } from '../../../shared/utils/toast';
import { useTranslation } from 'react-i18next';

export default function RegistrationScreen() {
    const { t } = useTranslation();
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
            showToast.success(t('vehicle-registered-successfully'));
            setTimeout(() => {
                router.replace('/');
            }, 1000);
        } else if (error) {
            showToast.error(error);
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
