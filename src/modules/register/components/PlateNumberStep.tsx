import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Input, Button } from '../../../shared/components';
import { REGION_CODES, RegionCode } from '../types/vehicle.types';
import { colors } from '../../../shared/theme/colors';

interface PlateNumberStepProps {
    onNext: (plate: string) => void;
}

export const PlateNumberStep: React.FC<PlateNumberStepProps> = ({ onNext }) => {
    const [regionCode, setRegionCode] = useState<RegionCode>('AA');
    const [plateNumber, setPlateNumber] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);

    const handleNext = () => {
        if (plateNumber.trim()) {
            const fullPlate = `${regionCode}-${plateNumber.trim()}`;
            onNext(fullPlate);
        }
    };

    return (
        <View className="flex-1 justify-center px-6">
            <Text className="text-3xl font-bold text-gray-800 mb-2">
                Welcome!
            </Text>
            <Text className="text-gray-500 mb-8">
                Let's register your vehicle to get you started
            </Text>

            <Text className="mb-2 text-sm font-semibold text-gray-700">
                Plate Number
            </Text>

            <View className="flex-row gap-3 mb-4">
                <TouchableOpacity
                    className="bg-gray-50 border-2 rounded-xl px-4 py-4 flex-row items-center justify-between"
                    style={{ borderColor: colors.gray[200], minWidth: 100 }}
                    onPress={() => setShowDropdown(!showDropdown)}
                >
                    <Text className="text-lg font-bold text-gray-800 mr-2">
                        {regionCode}
                    </Text>
                    <Ionicons
                        name={showDropdown ? 'chevron-up' : 'chevron-down'}
                        size={20}
                        color={colors.gray[500]}
                    />
                </TouchableOpacity>

                <View className="flex-1">
                    <Input
                        placeholder="00000"
                        value={plateNumber}
                        onChangeText={setPlateNumber}
                        keyboardType="numeric"
                        maxLength={10}
                        placeholderTextColor={colors.gray[200]}
                    />
                </View>
            </View>

            {showDropdown && (
                <ScrollView
                    className="bg-white border-2 rounded-xl mb-4 max-h-48"
                    style={{ borderColor: colors.gray[200] }}
                >
                    {REGION_CODES.map((code) => (
                        <TouchableOpacity
                            key={code}
                            className="px-4 py-3 border-b border-gray-100"
                            onPress={() => {
                                setRegionCode(code);
                                setShowDropdown(false);
                            }}
                        >
                            <Text
                                className={`text-lg font-semibold ${code === regionCode ? 'text-orange-500' : 'text-gray-700'
                                    }`}
                            >
                                {code}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            )}

            <Button
                title="Next"
                onPress={handleNext}
                disabled={!plateNumber.trim()}
                style={{ marginTop: 16 }}
            />
        </View>
    );
};
