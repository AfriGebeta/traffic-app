import React, { useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Image,
    TextInput,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from '../../../shared/hooks/useTranslation';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { colors } from '../../../shared/theme/colors';
import { showToast } from '../../../shared/utils/toast';
import { uploadToMinio } from '../../../shared/utils/minio';
import { useResolvedImageUri } from '../../../shared/hooks/useResolvedImageUri';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { userService } from '../../register/services/user.service';
import { useUserRegistration } from '../../register/hooks/useUserRegistration';
import { User, UpdateProfileRequest } from '../../register/types/user.types';
import { GenderSelect } from '../../register/components/GenderSelect';
import { FieldError } from '../../register/components/FormError';
import { toFullPhone, toLocalPhone, validateLocalPhone } from '../../register/utils/authValidation';
import { toFriendlyAuthError } from '../../register/utils/authErrors';

export const EditProfileScreen = () => {
    const router = useRouter();
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const { t } = useTranslation();
    const { colors: theme } = useTheme();
    const { getStoredUser, updateStoredUser } = useUserRegistration();

    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [name, setName] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [sex, setSex] = useState<number | null>(null);
    const [phoneError, setPhoneError] = useState<string | null>(null);
    const [pickedUri, setPickedUri] = useState<string | null>(null);
    const [uploadedImage, setUploadedImage] = useState<string | null>(null);
    const [removed, setRemoved] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
    const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
    const [pendingLeaveAction, setPendingLeaveAction] = useState<any>(null);
    // bypasses the dirty check for the one navigation the save flow triggers itself
    const allowNextLeaveRef = useRef(false);

    const storedLocalPhone = toLocalPhone(user?.phoneNumber);
    const storedSex = user?.sex === 0 || user?.sex === 1 ? user.sex : null;

    const isDirty = Boolean(user) && (
        name.trim() !== (user?.name || '') ||
        phoneNumber.trim() !== storedLocalPhone ||
        sex !== storedSex ||
        removed ||
        Boolean(uploadedImage)
    );

    const storedAvatar = useResolvedImageUri(user?.profileImage);
    const previewUri = removed
        ? null
        : pickedUri ?? storedAvatar ?? user?.profileImageLocal ?? null;
    const hasPicture = Boolean(previewUri);

    useEffect(() => {
        getStoredUser().then((storedUser) => {
            setUser(storedUser);
            setName(storedUser?.name || '');
            setPhoneNumber(toLocalPhone(storedUser?.phoneNumber));
            setSex(storedUser?.sex === 0 || storedUser?.sex === 1 ? storedUser.sex : null);
            setLoading(false);
        });
    }, []);

    const uploadImage = async (uri: string) => {
        if (!user) return;

        setUploading(true);
        try {
            const objectName = await uploadToMinio(uri, `users/${user.id}`);
            setPickedUri(uri);
            setUploadedImage(objectName);
            setRemoved(false);
        } catch (error) {
            showToast(`${t('upload-failed') || 'Upload failed'}: ${t('could-not-upload-image') || 'Could not upload image'}`);
        } finally {
            setUploading(false);
        }
    };

    const pickFromLibrary = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (status !== 'granted') {
            showToast(`${t('permission-denied') || 'Permission denied'}: ${t('gallery-permission-required') || 'Gallery permission required'}`);
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: 'images',
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });

        if (!result.canceled && result.assets[0]) {
            await uploadImage(result.assets[0].uri);
        }
    };

    const takePhoto = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();

        if (status !== 'granted') {
            showToast(`${t('permission-denied') || 'Permission denied'}: ${t('camera-permission-required') || 'Camera permission required'}`);
            return;
        }

        const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });

        if (!result.canceled && result.assets[0]) {
            await uploadImage(result.assets[0].uri);
        }
    };

    // intercepts every way off the screen: header back, hardware back, swipe gesture
    useEffect(() => {
        const unsubscribe = navigation.addListener('beforeRemove', (e: any) => {
            if (allowNextLeaveRef.current || !isDirty) return;

            e.preventDefault();
            setPendingLeaveAction(e.data.action);
            setShowDiscardConfirm(true);
        });

        return unsubscribe;
    }, [navigation, isDirty]);

    const confirmRemovePhoto = () => {
        setRemoved(true);
        setPickedUri(null);
        setUploadedImage(null);
        setShowRemoveConfirm(false);
    };

    const handleSave = async () => {
        if (!user) return;

        const trimmedName = name.trim();
        const trimmedPhone = phoneNumber.trim();

        if (!trimmedName) {
            showToast(t('name-required') || 'Name is required');
            return;
        }

        const phoneIssue = validateLocalPhone(t, trimmedPhone);
        setPhoneError(phoneIssue);
        if (phoneIssue) return;

        const payload: UpdateProfileRequest = {};

        if (trimmedName !== user.name) {
            payload.name = trimmedName;
        }
        if (trimmedPhone !== storedLocalPhone) {
            payload.phoneNumber = toFullPhone(trimmedPhone);
        }
        if (sex !== null && sex !== storedSex) {
            payload.sex = Number(sex);
        }
        if (removed) {
            payload.profileImage = null;
        } else if (uploadedImage) {
            payload.profileImage = uploadedImage;
        }

        if (Object.keys(payload).length === 0) {
            allowNextLeaveRef.current = true;
            router.back();
            return;
        }

        setSaving(true);
        try {
            const response = await userService.updateProfile(user.id, payload);

            if (response.error || !response.data) {
                const { code, message } = toFriendlyAuthError(t, 'profile', response.error, response.status);

                if (code === 'ALREADY_REGISTERED' && payload.phoneNumber) {
                    setPhoneError(message);
                } else {
                    showToast(message);
                }
                return;
            }

            const updatedUser = 'user' in response.data ? response.data.user : response.data;
            await updateStoredUser({
                name: updatedUser?.name ?? trimmedName,
                ...(payload.phoneNumber ? { phoneNumber: updatedUser?.phoneNumber ?? payload.phoneNumber } : {}),
                ...(payload.sex !== undefined ? { sex: updatedUser?.sex ?? payload.sex } : {}),
                ...(removed
                    ? { profileImage: null, profileImageLocal: null }
                    : {
                        profileImage: updatedUser?.profileImage ?? uploadedImage ?? user.profileImage,
                        ...(uploadedImage ? { profileImageLocal: pickedUri } : {}),
                    }),
            });

            allowNextLeaveRef.current = true;
            showToast(t('profile-updated') || 'Profile updated');
            router.back();
        } catch (error) {
            showToast(t('failed-to-update-profile') || 'Failed to update profile');
        } finally {
            setSaving(false);
        }
    };

    const getInitial = (value: string): string => value.charAt(0).toUpperCase();

    return (
        <View className="flex-1" style={{ backgroundColor: theme.background, paddingTop: insets.top }}>
            <View
                className="flex-row items-center px-4 py-3"
                style={{ borderBottomWidth: 1, borderBottomColor: theme.border }}
            >
                <TouchableOpacity onPress={() => router.back()} className="p-2" disabled={saving}>
                    <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
                </TouchableOpacity>
                <Text className="text-xl font-bold ml-2" style={{ color: theme.textPrimary }}>
                    {t('edit-profile') || 'Edit Profile'}
                </Text>
            </View>

            {loading ? (
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator color={colors.primary.main} />
                </View>
            ) : (
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    className="flex-1"
                >
                    <ScrollView
                        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
                        keyboardShouldPersistTaps="handled"
                    >
                        <View className="items-center pt-8">
                            <View>
                                {previewUri ? (
                                    <Image
                                        source={{ uri: previewUri }}
                                        style={{ width: 96, height: 96, borderRadius: 48 }}
                                    />
                                ) : (
                                    <View
                                        className="items-center justify-center"
                                        style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: colors.primary.main }}
                                    >
                                        <Text className="text-white text-3xl font-bold">
                                            {getInitial(name || user?.name || '?')}
                                        </Text>
                                    </View>
                                )}

                                {uploading && (
                                    <View
                                        className="absolute items-center justify-center"
                                        style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: 'rgba(0,0,0,0.45)' }}
                                    >
                                        <ActivityIndicator color="#fff" />
                                    </View>
                                )}

                                <TouchableOpacity
                                    onPress={pickFromLibrary}
                                    disabled={uploading || saving}
                                    className="absolute items-center justify-center"
                                    style={{
                                        right: -2,
                                        bottom: -2,
                                        width: 32,
                                        height: 32,
                                        borderRadius: 16,
                                        backgroundColor: colors.primary.main,
                                        borderWidth: 2,
                                        borderColor: theme.background,
                                    }}
                                >
                                    <Ionicons name="pencil" size={15} color="#fff" />
                                </TouchableOpacity>
                            </View>

                            <View className="flex-row gap-4 mt-4">
                                <TouchableOpacity
                                    onPress={pickFromLibrary}
                                    disabled={uploading || saving}
                                    className="flex-row items-center"
                                >
                                    <Ionicons name="images-outline" size={16} color={theme.textSecondary} />
                                    <Text className="ml-1.5 text-sm" style={{ color: theme.textSecondary }}>
                                        {t('gallery') || 'Gallery'}
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={takePhoto}
                                    disabled={uploading || saving}
                                    className="flex-row items-center"
                                >
                                    <Ionicons name="camera-outline" size={16} color={theme.textSecondary} />
                                    <Text className="ml-1.5 text-sm" style={{ color: theme.textSecondary }}>
                                        {t('take-photo') || 'Camera'}
                                    </Text>
                                </TouchableOpacity>

                                {hasPicture && (
                                    <TouchableOpacity
                                        onPress={() => setShowRemoveConfirm(true)}
                                        disabled={uploading || saving}
                                        className="flex-row items-center"
                                    >
                                        <Ionicons name="trash-outline" size={16} color={colors.error.main} />
                                        <Text className="ml-1.5 text-sm" style={{ color: colors.error.main }}>
                                            {t('remove') || 'Remove'}
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>

                        <View className="px-6 pt-8">
                            <Text className="text-xs mb-2" style={{ color: theme.textSecondary }}>
                                {t('name') || 'Name'}
                            </Text>
                            <TextInput
                                value={name}
                                onChangeText={setName}
                                placeholder={t('name') || 'Name'}
                                placeholderTextColor={theme.textSecondary}
                                editable={!saving}
                                className="rounded-xl px-4 py-3 text-base"
                                style={{
                                    borderWidth: 1,
                                    borderColor: theme.border,
                                    color: theme.textPrimary,
                                    backgroundColor: theme.surface,
                                }}
                            />

                            <Text className="text-xs mt-5 mb-2" style={{ color: theme.textSecondary }}>
                                {t('phone-number') || 'Phone Number'}
                            </Text>
                            <View
                                className="flex-row items-center rounded-xl"
                                style={{
                                    borderWidth: 1,
                                    borderColor: phoneError ? colors.error.main : theme.border,
                                    backgroundColor: theme.surface,
                                }}
                            >
                                <Text className="text-base pl-4" style={{ color: theme.textPrimary }}>
                                    +251
                                </Text>
                                <TextInput
                                    value={phoneNumber}
                                    onChangeText={(text) => {
                                        setPhoneNumber(text.replace(/\D/g, ''));
                                        setPhoneError(null);
                                    }}
                                    placeholder="912345678"
                                    placeholderTextColor={theme.textSecondary}
                                    keyboardType="phone-pad"
                                    maxLength={9}
                                    editable={!saving}
                                    className="flex-1 px-2 py-3 text-base"
                                    style={{ color: theme.textPrimary }}
                                />
                            </View>
                            <FieldError message={phoneError} />

                            <Text className="text-xs mt-5 mb-2" style={{ color: theme.textSecondary }}>
                                {t('gender') || 'Gender'}
                            </Text>
                            <GenderSelect
                                value={sex}
                                onChange={setSex}
                                maleLabel={t('male') || 'Male'}
                                femaleLabel={t('female') || 'Female'}
                                disabled={saving}
                                palette={{
                                    surface: theme.surface,
                                    border: theme.border,
                                    text: theme.textPrimary,
                                    selectedSurface: theme.primaryMuted,
                                    selectedBorder: theme.primary,
                                    selectedText: theme.textPrimary,
                                }}
                            />

                            <TouchableOpacity
                                onPress={handleSave}
                                disabled={saving || uploading}
                                className="rounded-xl py-4 items-center mt-6"
                                style={{ backgroundColor: colors.primary.main, opacity: saving || uploading ? 0.6 : 1 }}
                            >
                                {saving ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text className="text-white font-semibold text-base">{t('save') || 'Save'}</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>
            )}

            <ConfirmDialog
                visible={showRemoveConfirm}
                showDeleteIcon
                destructive
                title={t('remove-photo') || 'Remove photo'}
                message={t('remove-photo-confirm') || 'Remove your profile picture?'}
                confirmLabel={t('remove') || 'Remove'}
                cancelLabel={t('cancel') || 'Cancel'}
                onConfirm={confirmRemovePhoto}
                onCancel={() => setShowRemoveConfirm(false)}
            />

            <ConfirmDialog
                visible={showDiscardConfirm}
                destructive
                title={t('discard-changes') || 'Discard changes?'}
                message={t('discard-changes-confirm') || 'Your changes have not been saved.'}
                confirmLabel={t('discard') || 'Discard'}
                cancelLabel={t('keep-editing') || 'Keep editing'}
                onConfirm={() => {
                    setShowDiscardConfirm(false);
                    if (pendingLeaveAction) {
                        navigation.dispatch(pendingLeaveAction);
                        setPendingLeaveAction(null);
                    } else {
                        allowNextLeaveRef.current = true;
                        router.back();
                    }
                }}
                onCancel={() => {
                    setShowDiscardConfirm(false);
                    setPendingLeaveAction(null);
                }}
            />
        </View>
    );
};

export default EditProfileScreen;
