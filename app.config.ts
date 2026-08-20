import { ExpoConfig, ConfigContext } from 'expo/config';
import appConstants from './utils/constants.json';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: appConstants.APP_SHORT_NAME,
  slug: appConstants.APP_SLUG,
  version: appConstants.APP_VERSION,
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: appConstants.APP_SCHEME,
  userInterfaceStyle: 'automatic',
  platforms: ['android'],
  android: {
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    package: appConstants.PACKAGE_NAME,
    versionCode: appConstants.ANDROID_VERSION_CODE,
  },
  plugins: [
    'expo-router',
    'expo-dev-client',
    [
      'expo-splash-screen',
      {
        image: './assets/images/splash-icon.png',
        imageWidth: 200,
        resizeMode: 'contain',
        backgroundColor: '#ffffff',
        dark: {
          backgroundColor: '#000000',
        },
      },
    ],
    'expo-secure-store',
    'expo-font',
    'expo-image',
    'expo-status-bar',
    'expo-web-browser',
    'expo-sqlite',
    [
      'expo-audio',
      {
        enableBackgroundPlayback: true,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
});
