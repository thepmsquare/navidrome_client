const { withAppBuildGradle } = require('@expo/config-plugins');

/**
 * Expo config plugin to configure ndk debugSymbolLevel in android/app/build.gradle
 * for readable native stack traces in Google Play Console / Android Vitals.
 */
function withAndroidDebugSymbols(config, symbolLevel = 'SYMBOL_TABLE') {
  return withAppBuildGradle(config, (modConfig) => {
    if (modConfig.modResults.language === 'groovy') {
      const buildGradle = modConfig.modResults.contents;
      if (!buildGradle.includes('debugSymbolLevel')) {
        const targetPattern = /buildTypes\s*\{([\s\S]*?)release\s*\{/;
        if (targetPattern.test(buildGradle)) {
          modConfig.modResults.contents = buildGradle.replace(
            targetPattern,
            (match) => `${match}\n            ndk {\n                debugSymbolLevel '${symbolLevel}'\n            }`
          );
        }
      }
    }
    return modConfig;
  });
}

module.exports = withAndroidDebugSymbols;

