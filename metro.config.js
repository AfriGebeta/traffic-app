const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add support for resolving modules with .js extension
config.resolver.sourceExts.push('jsx', 'js', 'ts', 'tsx', 'json');

// Ensure node_modules are resolved correctly
config.resolver.nodeModulesPaths = [
    require('path').resolve(__dirname, 'node_modules'),
];

// Fix for react-native-toast-message module resolution
config.resolver.resolverMainFields = ['react-native', 'browser', 'main'];

module.exports = withNativeWind(config, { input: './src/app/globals.css' });
