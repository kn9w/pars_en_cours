const { withAppBuildGradle } = require('@expo/config-plugins');

/**
 * Expo config plugin to enable Android ABI splits for architecture-specific APKs
 * This creates separate, smaller APKs for each CPU architecture
 */
const withAndroidABISplits = (config) => {
  return withAppBuildGradle(config, (config) => {
    let buildGradle = config.modResults.contents;

    // Check if splits configuration already exists
    if (buildGradle.includes('splits {')) {
      console.log('⚠️  Splits configuration already exists in build.gradle');
      return config;
    }

    // Find the buildTypes block - we'll insert splits before it
    const buildTypesIndex = buildGradle.indexOf('buildTypes {');
    
    if (buildTypesIndex === -1) {
      console.warn('⚠️  Could not find buildTypes block in build.gradle');
      return config;
    }

    // Simple splits configuration
    const splitsConfig = `    splits {
        abi {
            enable true
            reset()
            include "armeabi-v7a", "arm64-v8a", "x86", "x86_64"
            universalApk true
        }
    }
    
    `;

    // Insert the splits config before buildTypes
    buildGradle = 
      buildGradle.substring(0, buildTypesIndex) +
      splitsConfig +
      buildGradle.substring(buildTypesIndex);

    config.modResults.contents = buildGradle;

    console.log('✅ Added Android ABI splits configuration to build.gradle');
    
    return config;
  });
};

module.exports = withAndroidABISplits;

