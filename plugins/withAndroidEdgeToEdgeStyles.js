const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('@expo/config-plugins');

/**
 * Expo config plugin to generate res/values-v35/styles.xml with AppTheme
 * omitting android:statusBarColor and android:navigationBarColor, which are
 * deprecated on Android 15 (API 35+) where edge-to-edge is enforced.
 */
function withAndroidEdgeToEdgeStyles(config) {
  return withDangerousMod(config, [
    'android',
    async (modConfig) => {
      const resDir = path.join(
        modConfig.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'res'
      );
      const baseStylesPath = path.join(resDir, 'values', 'styles.xml');
      if (!fs.existsSync(baseStylesPath)) {
        return modConfig;
      }

      const baseStyles = fs.readFileSync(baseStylesPath, 'utf8');
      const appThemeMatch = baseStyles.match(
        /<style\s+name="AppTheme"[\s\S]*?<\/style>/
      );
      if (!appThemeMatch) {
        return modConfig;
      }

      const filteredAppTheme = appThemeMatch[0]
        .replace(
          /^[ \t]*<item\s+name="android:(?:statusBarColor|navigationBarColor)"[^>]*>[\s\S]*?<\/item>[ \t]*\r?\n?/gm,
          ''
        )
        .trimEnd();

      const v35Dir = path.join(resDir, 'values-v35');
      fs.mkdirSync(v35Dir, { recursive: true });
      const v35Styles = `<resources>\n  ${filteredAppTheme}\n</resources>\n`;
      fs.writeFileSync(path.join(v35Dir, 'styles.xml'), v35Styles, 'utf8');

      return modConfig;
    },
  ]);
}

module.exports = withAndroidEdgeToEdgeStyles;
