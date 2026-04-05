import 'package:dynamic_color/dynamic_color.dart';
import 'package:flutter/material.dart';
import 'package:just_audio_background/just_audio_background.dart';
import 'package:navidrome_client/pages/connect_page.dart';
import 'package:navidrome_client/pages/home_page.dart';
import 'package:navidrome_client/services/auth_service.dart';
import 'package:navidrome_client/services/offline_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await JustAudioBackground.init(
    androidNotificationChannelId: 'com.ryanheise.audioservice.audio',
    androidNotificationChannelName: 'audio playback',
    androidNotificationOngoing: true,
    androidNotificationIcon: 'drawable/ic_stat_music',
  );
  // load offline state into memory before any UI renders
  await OfflineService().initialize();

  final authService = AuthService();
  final isLoggedIn = await authService.isLoggedIn;
  
  runApp(MyApp(isLoggedIn: isLoggedIn));
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
          title: 'navidrome client by thepmsquare',
          debugShowCheckedModeBanner: false,
          theme: baseTheme,
          darkTheme: baseDarkTheme,
          initialRoute: isLoggedIn ? '/home' : '/connect',
          routes: {
            '/connect': (context) => const ConnectPage(),
            '/home': (context) => const HomePage(),
          },
        );
      },
    );
  }
}
