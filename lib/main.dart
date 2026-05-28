import 'dart:io' show Platform;
import 'package:dynamic_color/dynamic_color.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:sentry_flutter/sentry_flutter.dart';
import 'package:just_audio_background/just_audio_background.dart';
import 'package:m3e_collection/m3e_collection.dart';
import 'package:navidrome_client/pages/connect_page.dart';
import 'package:navidrome_client/pages/home_page.dart';
import 'package:navidrome_client/services/auth_service.dart';
import 'package:navidrome_client/services/offline_service.dart';
import 'package:navidrome_client/services/session_service.dart';
import 'package:navidrome_client/utils/constants.dart';
import 'package:package_info_plus/package_info_plus.dart';


void main() async {
  const sentryDsn = String.fromEnvironment('SENTRY_DSN');

  Future<void> runAppWithSettings() async {
    WidgetsFlutterBinding.ensureInitialized();

    // run independent init steps in parallel for faster cold start
    final results = await Future.wait([
      SessionService().stopPlaybackOnTaskRemoved,
      OfflineService().initialize().then((_) => null),
    ]);

    // #11: load stop playback setting for android initialization
    final stopPlaybackOnTaskRemoved = results[0] as bool;

    if (Platform.isAndroid || Platform.isIOS) {
      await JustAudioBackground.init(
        androidNotificationChannelId: 'com.ryanheise.audioservice.audio',
        androidNotificationChannelName: 'audio playback',
        // On Android, if stopPlaybackOnTaskRemoved is true, we make the notification
        // non-ongoing so it can be automatically dismissed or swiped away properly.
        androidNotificationOngoing:
            Platform.isAndroid ? !stopPlaybackOnTaskRemoved : true,
        androidNotificationIcon: 'drawable/ic_notification',
      );
    }

    final authService = AuthService();
    final isLoggedIn = await authService.isLoggedIn;

    try {
      final packageInfo = await PackageInfo.fromPlatform();
      Sentry.configureScope((scope) {
        scope.setTag('client_version', '${packageInfo.version}+${packageInfo.buildNumber}');
        scope.setTag('subsonic_api_version', '1.16.1');
      });
      if (isLoggedIn) {
        final url = await authService.serverUrl;
        final user = await authService.username;
        Sentry.configureScope((scope) {
          scope.setTag('server_url', url ?? 'unknown');
          scope.setUser(SentryUser(username: user));
        });
      }
    } catch (_) {}

    runApp(MyApp(isLoggedIn: isLoggedIn));
  }

  if (sentryDsn.isNotEmpty) {
    await SentryFlutter.init(
      (options) {
        options.dsn = sentryDsn;
        options.tracesSampleRate = 1.0;
      },
      appRunner: runAppWithSettings,
    );
  } else {
    await runAppWithSettings();
  }
}

class MyApp extends StatefulWidget {
  final bool isLoggedIn;
  const MyApp({super.key, required this.isLoggedIn});

  @override
  State<MyApp> createState() => MyAppState();
}

class MyAppState extends State<MyApp> {
  String _fontFamily = 'system';

  @override
  void initState() {
    super.initState();
    _loadSettings();
  }

  Future<void> _loadSettings() async {
    final font = await SessionService().fontFamily;
    if (mounted) {
      setState(() {
        _fontFamily = font;
      });
    }
  }

  void updateFont(String font) {
    if (mounted) {
      setState(() {
        _fontFamily = font;
      });
    }
  }

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

        TextTheme applyFont(TextTheme baseTextTheme) {
          switch (_fontFamily) {
            case 'outfit':
              return GoogleFonts.outfitTextTheme(baseTextTheme);
            case 'inter':
              return GoogleFonts.interTextTheme(baseTextTheme);
            case 'lexend':
              return GoogleFonts.lexendTextTheme(baseTextTheme);
            case 'playfair display':
              return GoogleFonts.playfairDisplayTextTheme(baseTextTheme);
            case 'poppins':
              return GoogleFonts.poppinsTextTheme(baseTextTheme);
            default:
              return baseTextTheme;
          }
        }

        var baseTheme = lightColorScheme.toM3EThemeData();
        baseTheme = baseTheme.copyWith(
          typography: Typography.material2021(),
          textTheme: applyFont(baseTheme.textTheme),
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

        var baseDarkTheme = darkColorScheme.toM3EThemeData();
        baseDarkTheme = baseDarkTheme.copyWith(
          typography: Typography.material2021(),
          textTheme: applyFont(baseDarkTheme.textTheme),
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
          initialRoute: widget.isLoggedIn ? '/home' : '/connect',
          routes: {
            '/connect': (context) => const ConnectPage(),
            '/home': (context) => const HomePage(),
          },
        );
      },
    );
  }
}
