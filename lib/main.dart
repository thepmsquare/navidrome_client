import 'package:dynamic_color/dynamic_color.dart';
import 'package:flutter/material.dart';
import 'package:just_audio_background/just_audio_background.dart';
import 'package:navidrome_client/pages/connect_page.dart';
import 'package:navidrome_client/pages/home_page.dart';
import 'package:navidrome_client/services/auth_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await JustAudioBackground.init(
    androidNotificationChannelId: 'com.ryanheise.audioservice.audio',
    androidNotificationChannelName: 'audio playback',
    androidNotificationOngoing: true,
  );
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
        return MaterialApp(
          title: 'navidrome client by thepmsquare',
          debugShowCheckedModeBanner: false,
          theme: ThemeData(
            colorScheme: lightDynamic ??
                ColorScheme.fromSeed(seedColor: Colors.teal),
            useMaterial3: true,
          ),
          darkTheme: ThemeData(
            colorScheme: darkDynamic ??
                ColorScheme.fromSeed(
                  seedColor: Colors.teal,
                  brightness: Brightness.dark,
                ),
            useMaterial3: true,
          ),
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
