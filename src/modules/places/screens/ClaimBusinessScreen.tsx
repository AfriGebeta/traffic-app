import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert, TextInput } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '../../../shared/hooks/useTranslation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import { placeService } from '../services/place.service';
import { showToast } from '../../../shared/utils/toast';
import { colors } from '../../../shared/theme/colors';

type VerificationMethod = 'TRADE_LICENSE' | 'TIN_CERTIFICATE';

export default function ClaimBusinessScreen() {
    const router = useRouter();
    const { placeId, placeName } = useLocalSearchParams<{ placeId: string; placeName: string }>();
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();

    const [verificationMethod, setVerificationMethod] = useState<VerificationMethod>('TRADE_LICENSE');
    const [selectedDocument, setSelectedDocument] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
    const [tinNumber, setTinNumber] = useState('');
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    const handleDocumentPick = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['application/pdf', 'image/*'],
                copyToCacheDirectory: true,
            });

            if (!result.canceled && result.assets[0]) {
                setSelectedDocument(result.assets[0]);
            }
        } catch (error) {
            showToast(t('failed-to-pick-document'));
        }
    };

    const handleSubmit = async () => {
        if (!selectedDocument) {
            Alert.alert(t('error'), t('please-upload-verification-document'));
            return;
        }

        if (verificationMethod === 'TIN_CERTIFICATE' && !tinNumber.trim()) {
            Alert.alert(t('error'), t('please-enter-tin-number'));
            return;
        }

        setUploading(true);
        setUploadProgress(0);

        try {
            const documentKey = await placeService.uploadClaimDocument(
                selectedDocument.uri,
                selectedDocument.name,
                (progress) => setUploadProgress(progress)
            );

            await placeService.claimBusiness(placeId, {
                verificationMethod,
                documentKey,
                tinNumber: verificationMethod === 'TIN_CERTIFICATE' ? tinNumber : undefined,
            });

            showToast(t('claim-submitted-successfully'));
            router.back();
        } catch (error: any) {
            showToast(error.message || t('failed-to-submit-claim'));
        } finally {
            setUploading(false);
            setUploadProgress(0);
        }
    };

    return (
        <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
            <View className="px-4 py-6 bg-white border-b border-gray-200">
                <View className="flex-row items-center mb-2">
                    <TouchableOpacity onPress={() => router.back()} className="mr-4" activeOpacity={0.7}>
                        <Ionicons name="arrow-back" size={28} color="#FFA500" />
                    </TouchableOpacity>
                    <Text className="text-2xl font-bold text-gray-900">{t('claim-business')}</Text>
                </View>
                <Text className="text-gray-600 mt-2">{placeName || t('claim-this-business')}</Text>
            </View>

            <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
                <View className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-4">
                    <Text className="text-lg font-semibold text-gray-900 mb-4">{t('verification-method')}</Text>

                    <TouchableOpacity
                        className="flex-row items-center p-4 rounded-xl mb-3 border-2 bg-white"
                        style={{
                            borderColor: verificationMethod === 'TRADE_LICENSE' ? colors.primary.main : '#E5E7EB'
                        }}
                        onPress={() => setVerificationMethod('TRADE_LICENSE')}
                        activeOpacity={0.7}
                    >
                        <View
                            className="w-6 h-6 rounded-full border-2 items-center justify-center mr-3"
                            style={{
                                borderColor: verificationMethod === 'TRADE_LICENSE' ? colors.primary.main : '#D1D5DB'
                            }}
                        >
                            {verificationMethod === 'TRADE_LICENSE' && (
                                <View className="w-3 h-3 rounded-full" style={{ backgroundColor: colors.primary.main }} />
                            )}
                        </View>
                        <View className="flex-1">
                            <Text className="text-base font-semibold text-gray-900">{t('trade-license')}</Text>
                            <Text className="text-sm text-gray-600 mt-1">{t('upload-your-trade-license')}</Text>
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                        className="flex-row items-center p-4 rounded-xl border-2 bg-white"
                        style={{
                            borderColor: verificationMethod === 'TIN_CERTIFICATE' ? colors.primary.main : '#E5E7EB'
                        }}
                        onPress={() => setVerificationMethod('TIN_CERTIFICATE')}
                        activeOpacity={0.7}
                    >
                        <View
                            className="w-6 h-6 rounded-full border-2 items-center justify-center mr-3"
                            style={{
                                borderColor: verificationMethod === 'TIN_CERTIFICATE' ? colors.primary.main : '#D1D5DB'
                            }}
                        >
                            {verificationMethod === 'TIN_CERTIFICATE' && (
                                <View className="w-3 h-3 rounded-full" style={{ backgroundColor: colors.primary.main }} />
                            )}
                        </View>
                        <View className="flex-1">
                            <Text className="text-base font-semibold text-gray-900">{t('tin-certificate')}</Text>
                            <Text className="text-sm text-gray-600 mt-1">{t('upload-your-tin-certificate')}</Text>
                        </View>
                    </TouchableOpacity>
                </View>

                {verificationMethod === 'TIN_CERTIFICATE' && (
                    <View className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-4">
                        <Text className="text-sm font-semibold text-gray-700 mb-2">{t('tin-number')}</Text>
                        <TextInput
                            className="bg-gray-50 rounded-xl border border-gray-200 px-4 py-3 text-gray-900 text-base"
                            placeholder="0012345678"
                            placeholderTextColor="#9CA3AF"
                            value={tinNumber}
                            onChangeText={setTinNumber}
                            maxLength={10}
                            keyboardType="number-pad"
                        />
                        <Text className="text-gray-500 text-xs mt-2">{t('enter-10-digit-tin')}</Text>
                    </View>
                )}

                <View className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-4">
                    <Text className="text-lg font-semibold text-gray-900 mb-4">{t('upload-document')}</Text>

                    {selectedDocument ? (
                        <View className="bg-green-50 border-2 border-green-200 rounded-xl p-4 mb-4">
                            <View className="flex-row items-center">
                                <Ionicons name="document-text" size={24} color="#10B981" />
                                <View className="flex-1 ml-3">
                                    <Text className="text-gray-900 font-semibold" numberOfLines={1}>
                                        {selectedDocument.name}
                                    </Text>
                                    {selectedDocument.size && (
                                        <Text className="text-gray-600 text-sm mt-1">
                                            {(selectedDocument.size / 1024 / 1024).toFixed(2)} MB
                                        </Text>
                                    )}
                                </View>
                                <TouchableOpacity onPress={() => setSelectedDocument(null)}>
                                    <Ionicons name="close-circle" size={24} color="#EF4444" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : null}

                    <TouchableOpacity
                        className="border-2 border-dashed border-gray-300 rounded-xl p-6 items-center justify-center bg-gray-50"
                        onPress={handleDocumentPick}
                        activeOpacity={0.7}
                        disabled={uploading}
                    >
                        <Ionicons name="cloud-upload-outline" size={48} color="#9CA3AF" />
                        <Text className="text-gray-900 font-semibold mt-3">{t('choose-file')}</Text>
                        <Text className="text-gray-500 text-sm mt-1">{t('pdf-or-image-max-10mb')}</Text>
                    </TouchableOpacity>

                    {uploading && uploadProgress > 0 && (
                        <View className="mt-4">
                            <View className="bg-gray-200 h-2 rounded-full overflow-hidden">
                                <View
                                    className="bg-orange-500 h-full"
                                    style={{ width: `${uploadProgress}%` }}
                                />
                            </View>
                            <Text className="text-center text-sm text-gray-600 mt-2">
                                {t('uploading')} {Math.round(uploadProgress)}%
                            </Text>
                        </View>
                    )}
                </View>

                <TouchableOpacity
                    className={`rounded-xl p-4 items-center justify-center ${uploading || !selectedDocument ? 'bg-gray-300' : 'bg-orange-500'
                        }`}
                    onPress={handleSubmit}
                    activeOpacity={0.7}
                    disabled={uploading || !selectedDocument}
                >
                    {uploading ? (
                        <ActivityIndicator color="#FFFFFF" />
                    ) : (
                        <Text className="text-white font-bold text-lg">{t('submit-claim')}</Text>
                    )}
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
}
