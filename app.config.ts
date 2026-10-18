import { ExpoConfig, ConfigContext } from 'expo/config';
import packageJson from './package.json';

const isDev = process.env.APP_VARIANT === 'development';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: isDev ? 'navidrome client (dev)' : 'navidrome client',
  slug: 'navidrome_client',
  version: packageJson.version,
  orientation: 'portrait',
  icon: isDev ? './assets/branding/icon_dev.png' : './assets/branding/icon.png',
  scheme: isDev ? 'navidromeclient-dev' : 'navidromeclient',
  userInterfaceStyle: 'automatic',
  platforms: ['android'],
  android: {
    adaptiveIcon: {
      backgroundColor: '#000000',
      foregroundImage: isDev
        ? './assets/branding/foreground_layer_colored_dev.png'
        : './assets/branding/foreground_layer_colored.png',
      monochromeImage: './assets/branding/foreground_layer_black.png',
    },
    predictiveBackGestureEnabled: false,
    package: isDev
      ? 'com.thepmsquare.navidrome_client.dev'
      : 'com.thepmsquare.navidrome_client',
    versionCode: packageJson.versionCode,
    permissions: [
      'android.permission.INTERNET',
      'android.permission.WAKE_LOCK',
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
      'android.permission.POST_NOTIFICATIONS',
    ],
  },
  plugins: [
    'expo-router',
    'expo-dev-client',
    [
      'expo-splash-screen',
      {
        image: isDev
          ? './assets/branding/icon_dev.png'
          : './assets/branding/icon.png',
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
      'expo-build-properties',
      {
        android: {
          usesCleartextTraffic: true,
        },
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
});
