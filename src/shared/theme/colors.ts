export const colors = {
    primary: {
        main: '#ffa500',
        light: '#fde2aeff',
        dark: '#ffa500',
    },
    error: {
        main: '#EF4444',
        light: '#FCA5A5',
    },
    gray: {
        50: '#F9FAFB',
        100: '#F3F4F6',
        200: '#E5E7EB',
        500: '#6B7280',
        700: '#374151',
        800: '#1F2937',
    },
    white: '#FFFFFF',
    black: '#000000',
} as const;

export const lightTheme = {
    background: '#FFFFFF',
    surface: '#F7F7F7',
    border: '#E0E0E0',
    primary: '#FFA500',
    primaryHover: '#E69400',
    primaryMuted: '#FFF1D6',
    textPrimary: '#1A1A1A',
    textSecondary: '#6B6B6B',
    green: '#2E7D32',
    greenMuted: '#E6F4E8',
    blue: '#1976D2',
    blueMuted: '#E5F0FB',
    error: '#D32F2F',
} as const;

export const darkTheme = {
    background: '#121212',
    surface: '#1E1E1E',
    border: '#333333',
    primary: '#FFA500',
    primaryHover: '#FFC04D',
    primaryMuted: '#4D3400',
    textPrimary: '#F2F2F2',
    textSecondary: '#A0A0A0',
    green: '#4CAF7D',
    greenMuted: '#16302A',
    blue: '#4A9EFF',
    blueMuted: '#142A42',
    error: '#FF6B6B',
} as const;

export type ThemeColors = { [K in keyof typeof lightTheme]: string };

export const tailwindColors = {
    primary: 'orange-500',
    primaryLight: 'orange-300',
    primaryDark: 'orange-600',
    error: 'red-500',
    errorLight: 'red-300',
} as const;
