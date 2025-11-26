import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../../shared/components';
import { CAR_MODELS, CarModel } from '../types/vehicle.types';
import { colors } from '../../../shared/theme/colors';
import { useTranslation } from 'react-i18next';

interface CarModelStepProps {
    plate: string;
    onBack: () => void;
    onSubmit: (model: string) => void;
    loading: boolean;
}

export const CarModelStep: React.FC<CarModelStepProps> = ({
    plate,
    onBack,
    onSubmit,
    loading,
}) => {
    const { t } = useTranslation();
    const [selectedModel, setSelectedModel] = useState<CarModel | null>(null);

    const handleSubmit = () => {
        if (selectedModel) {
            onSubmit(selectedModel);
        }
    };

    return (
        <View className="flex-1 px-6 pt-12">
            <TouchableOpacity onPress={onBack} className="mb-4">
                <Ionicons name="arrow-back" size={28} color={colors.primary.main} />
            </TouchableOpacity>

            <Text className="text-3xl font-bold text-gray-800 mb-2">
                {t('select-your-car-model')}
            </Text>
            <Text className="text-gray-500 mb-2">
                {t('plate')}: {plate}
            </Text>
            <Text className="text-gray-400 text-sm mb-6">
                {t('choose-your-vehicle-model-from-the-list')}
            </Text>

            <ScrollView className="flex-1 mb-6" showsVerticalScrollIndicator={false}>
                <View className="gap-3 pb-4">
                    {CAR_MODELS.map((model) => (
                        <TouchableOpacity
                            key={model}
                            className={`rounded-xl p-4 flex-row items-center justify-between border-2 ${selectedModel === model ? 'bg-orange-50' : 'bg-gray-50'
                                }`}
                            style={{
                                borderColor:
                                    selectedModel === model
                                        ? colors.primary.main
                                        : colors.gray[200],
                            }}
                            onPress={() => setSelectedModel(model)}
                            activeOpacity={0.7}
                        >
                            <Text
                                className={`text-lg font-semibold ${selectedModel === model ? 'text-gray-800' : 'text-gray-600'
                                    }`}
                            >
                                {model}
                            </Text>
                            {selectedModel === model && (
                                <Ionicons
                                    name="checkmark-circle"
                                    size={24}
                                    color={colors.primary.main}
                                />
                            )}
                        </TouchableOpacity>
                    ))}
                </View>
            </ScrollView>

            <View className="pb-6">
                <Button
                    title={t('register-vehicle')}
                    onPress={handleSubmit}
                    disabled={!selectedModel}
                    loading={loading}
                />
            </View>
        </View>
    );
};
