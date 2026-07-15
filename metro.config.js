const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);


config.resolver.sourceExts.push('jsx', 'js', 'ts', 'tsx', 'json');


config.resolver.nodeModulesPaths = [
    require('path').resolve(__dirname, 'node_modules'),
];


config.resolver.resolverMainFields = ['react-native', 'browser', 'main'];


config.transformer.babelTransformerPath = require.resolve('react-native-svg-transformer');
config.resolver.assetExts = config.resolver.assetExts.filter((ext) => ext !== 'svg');
config.resolver.sourceExts.push('svg');

module.exports = withNativeWind(config, { input: './src/app/globals.css' });
