import Toast from 'react-native-toast-message';

export const showToast = {
    success: (message: string, title?: string) => {
        Toast.show({
            type: 'success',
            text1: title || 'Success',
            text2: message,
            position: 'top',
            visibilityTime: 3000,
            topOffset: 120,
        });
    },

    error: (message: string, title?: string) => {
        Toast.show({
            type: 'error',
            text1: title || 'Error',
            text2: message,
            position: 'top',
            visibilityTime: 4000,
            topOffset: 120,
        });
    },

    info: (message: string, title?: string) => {
        Toast.show({
            type: 'info',
            text1: title || 'Info',
            text2: message,
            position: 'top',
            visibilityTime: 3000,
            topOffset: 120,
        });
    },
};
