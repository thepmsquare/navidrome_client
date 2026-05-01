import 'dart:io' show Platform;
import 'package:dynamic_color/dynamic_color.dart';
import 'package:flutter/material.dart';
import 'package:sentry_flutter/sentry_flutter.dart';
import 'package:just_audio_background/just_audio_background.dart';
import 'package:navidrome_client/pages/connect_page.dart';
import 'package:navidrome_client/pages/home_page.dart';
import 'package:navidrome_client/services/auth_service.dart';
import 'package:navidrome_client/services/offline_service.dart';
import 'package:navidrome_client/services/session_service.dart';
import 'package:navidrome_client/utils/constants.dart';
import 'package:navidrome_client/components/persistent_player.dart';

void main() async {
  await SentryFlutter.init(
    (options) {
      options.dsn = 'https://2b0b77baab7bf5de9dd39d82ac52b6ac@o4511263909740544.ingest.de.sentry.io/4511263935103056';
      options.tracesSampleRate = 1.0;
      options.profilesSampleRate = 1.0;
    },
    appRunner: () async {
      WidgetsFlutterBinding.ensureInitialized();

      // run independent init steps in parallel for faster cold start
      final results = await Future.wait([
        SessionService().stopPlaybackOnTaskRemoved,
        OfflineService().initialize().then((_) => null),
      ]);

      // #11: load stop playback setting for android initialization
      final stopPlaybackOnTaskRemoved = results[0] as bool;

      await JustAudioBackground.init(
        androidNotificationChannelId: 'com.ryanheise.audioservice.audio',
        androidNotificationChannelName: 'audio playback',
        // On Android, if stopPlaybackOnTaskRemoved is true, we make the notification
        // non-ongoing so it can be automatically dismissed or swiped away properly.
        androidNotificationOngoing:
            Platform.isAndroid ? !stopPlaybackOnTaskRemoved : true,
        androidNotificationIcon: 'drawable/ic_notification',
      );

      final authService = AuthService();
      final isLoggedIn = await authService.isLoggedIn;

      runApp(MyApp(isLoggedIn: isLoggedIn));
    },
  );
}

class MyApp extends StatelessWidget {
  final bool isLoggedIn;
  const MyApp({super.key, required this.isLoggedIn});

  @override
  Widget build(BuildContext context) {
    return DynamicColorBuilder(
      builder: (ColorScheme? lightDynamic, ColorScheme? darkDynamic) {
        ColorScheme lightColorScheme;
        ColorScheme darkColorScheme;

        if (lightDynamic != null && darkDynamic != null) {
          lightColorScheme = lightDynamic.harmonized();
          darkColorScheme = darkDynamic.harmonized();
        } else {
          lightColorScheme = ColorScheme.fromSeed(
            seedColor: Colors.teal,
            dynamicSchemeVariant: DynamicSchemeVariant.expressive,
          );
          darkColorScheme = ColorScheme.fromSeed(
            seedColor: Colors.teal,
            dynamicSchemeVariant: DynamicSchemeVariant.expressive,
            brightness: Brightness.dark,
          );
        }

        final baseTheme = ThemeData(
          useMaterial3: true,
          colorScheme: lightColorScheme,
          typography: Typography.material2021(),
          appBarTheme: const AppBarTheme(
            centerTitle: true,
            scrolledUnderElevation: 0,
          ),
          cardTheme: CardThemeData(
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(24),
            ),
            elevation: 0,
            color: lightColorScheme.surfaceContainerLow,
          ),
          inputDecorationTheme: InputDecorationTheme(
            filled: true,
            fillColor: lightColorScheme.surfaceContainerHigh,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(16),
              borderSide: BorderSide.none,
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(16),
              borderSide: BorderSide.none,
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(16),
              borderSide: BorderSide(
                color: lightColorScheme.primary,
                width: 2,
              ),
            ),
            contentPadding: const EdgeInsets.symmetric(
              horizontal: 24,
              vertical: 20,
            ),
          ),
          filledButtonTheme: FilledButtonThemeData(
            style: FilledButton.styleFrom(
              padding: const EdgeInsets.symmetric(
                horizontal: 32,
                vertical: 16,
              ),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
              ),
            ),
          ),
        );

        final baseDarkTheme = ThemeData(
          useMaterial3: true,
          colorScheme: darkColorScheme,
          typography: Typography.material2021(),
          appBarTheme: const AppBarTheme(
            centerTitle: true,
            scrolledUnderElevation: 0,
          ),
          cardTheme: CardThemeData(
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(24),
            ),
            elevation: 0,
            color: darkColorScheme.surfaceContainerLow,
          ),
          inputDecorationTheme: InputDecorationTheme(
            filled: true,
            fillColor: darkColorScheme.surfaceContainerHigh,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(16),
              borderSide: BorderSide.none,
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(16),
              borderSide: BorderSide.none,
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(16),
              borderSide: BorderSide(
                color: darkColorScheme.primary,
                width: 2,
              ),
            ),
            contentPadding: const EdgeInsets.symmetric(
              horizontal: 24,
              vertical: 20,
            ),
          ),
          filledButtonTheme: FilledButtonThemeData(
            style: FilledButton.styleFrom(
              padding: const EdgeInsets.symmetric(
                horizontal: 32,
                vertical: 16,
              ),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
              ),
            ),
          ),
        );

        return MaterialApp(
          title: appDisplayName,
          debugShowCheckedModeBanner: false,
          theme: baseTheme,
          darkTheme: baseDarkTheme,
          navigatorObservers: [
            SentryNavigatorObserver(),
          ],
          initialRoute: isLoggedIn ? '/home' : '/connect',
          routes: {
            '/connect': (context) => const ConnectPage(),
            '/home': (context) => const HomePage(),
          },
          builder: (context, child) => PersistentPlayer(child: child!),
        );
      },
    );
  }
}
