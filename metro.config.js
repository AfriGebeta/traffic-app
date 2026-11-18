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

const deviceInfoShim = require('path').resolve(__dirname, 'src/shared/shims/react-native-device-info.ts');
const upstreamResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (moduleName === 'react-native-device-info') {
        return { type: 'sourceFile', filePath: deviceInfoShim };
    }
    return upstreamResolveRequest
        ? upstreamResolveRequest(context, moduleName, platform)
        : context.resolveRequest(context, moduleName, platform);
};

// Support importing .svg files as React components
config.transformer.babelTransformerPath = require.resolve('react-native-svg-transformer');
config.resolver.assetExts = config.resolver.assetExts.filter((ext) => ext !== 'svg');
config.resolver.sourceExts.push('svg');

module.exports = withNativeWind(config, { input: './src/app/globals.css' });
