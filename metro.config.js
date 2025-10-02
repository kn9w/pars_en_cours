const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Fix for @noble/hashes and @noble/curves crypto.js import issues
config.resolver.resolverMainFields = ['react-native', 'browser', 'main'];
config.resolver.platforms = ['ios', 'android', 'native', 'web'];

// Disable package exports resolution for problematic @noble packages
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
