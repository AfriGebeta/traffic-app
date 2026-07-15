module.exports = function (api) {
    api.cache(true);
    return {
        presets: [
            'babel-preset-expo',
            'nativewind/babel',
        ],
        plugins: [
            [
                'module-resolver',
                {
                    root: ['./'],
                    alias: {
                        '@': './src',
                        '@expo/vector-icons': './src/components/localIconCompatibility',
                    },
                    extensions: [
                        '.ios.ts',
                        '.android.ts',
                        '.ts',
                        '.ios.tsx',
                        '.android.tsx',
                        '.tsx',
                        '.jsx',
                        '.js',
                        '.json',
                    ],
                },
            ],
            'react-native-reanimated/plugin',
        ],
    };
};

