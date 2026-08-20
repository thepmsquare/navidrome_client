import { ExpoConfig, ConfigContext } from 'expo/config';
import appConstants from './utils/constants.json';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: appConstants.APP_SHORT_NAME,
  slug: appConstants.APP_SLUG,
  version: appConstants.APP_VERSION,
  orientation: 'portrait',
  icon: './assets/branding/icon.png',
  scheme: appConstants.APP_SCHEME,
  userInterfaceStyle: 'automatic',
  platforms: ['android'],
  android: {
    adaptiveIcon: {
      backgroundColor: '#000000',
      foregroundImage: './assets/branding/foreground_layer_colored.png',
      monochromeImage: './assets/branding/foreground_layer_black.png',
    },
    predictiveBackGestureEnabled: false,
    package: appConstants.PACKAGE_NAME,
    versionCode: appConstants.ANDROID_VERSION_CODE,
    permissions: [
      'android.permission.INTERNET',
      'android.permission.WAKE_LOCK',
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
    ],
  },
  plugins: [
    'expo-router',
    'expo-dev-client',
    [
      'expo-splash-screen',
      {
        image: './assets/branding/icon.png',
        imageWidth: 200,
        resizeMode: 'contain',
        backgroundColor: '#000000',
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
