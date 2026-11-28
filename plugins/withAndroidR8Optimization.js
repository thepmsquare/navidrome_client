const { withAppBuildGradle, withGradleProperties } = require('@expo/config-plugins');

/**
 * Expo config plugin to enable R8 full optimization (proguard-android-optimize.txt)
 * and R8 optimized resource shrinking (android.r8.optimizedResourceShrinking=true).
 */
function withAndroidR8Optimization(config) {
  config = withAppBuildGradle(config, (modConfig) => {
    if (modConfig.modResults.language === 'groovy') {
      modConfig.modResults.contents = modConfig.modResults.contents.replace(
        /getDefaultProguardFile\((['"])proguard-android\.txt\1\)/g,
        'getDefaultProguardFile($1proguard-android-optimize.txt$1)'
      );
    }
    return modConfig;
  });

  config = withGradleProperties(config, (modConfig) => {
    const key = 'android.r8.optimizedResourceShrinking';
    const existing = modConfig.modResults.find(
      (item) => item.type === 'property' && item.key === key
    );
    if (existing) {
      existing.value = 'true';
    } else {
      modConfig.modResults.push({
        type: 'property',
        key,
        value: 'true',
      });
    }
    return modConfig;
  });

  return config;
}

module.exports = withAndroidR8Optimization;
