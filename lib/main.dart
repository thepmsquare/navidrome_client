import 'package:dynamic_color/dynamic_color.dart';
import 'package:flutter/material.dart';
import 'package:navidrome_client/pages/connect_page.dart';
import 'package:navidrome_client/pages/home_page.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return DynamicColorBuilder(
      builder: (ColorScheme? lightDynamic, ColorScheme? darkDynamic) {
        return MaterialApp(
          title: 'navidrome client',
          debugShowCheckedModeBanner: false,
          theme: ThemeData(
            colorScheme: lightDynamic ??
                ColorScheme.fromSeed(seedColor: Colors.deepPurple),
            useMaterial3: true,
          ),
          darkTheme: ThemeData(
            colorScheme: darkDynamic ??
                ColorScheme.fromSeed(
                  seedColor: Colors.deepPurple,
                  brightness: Brightness.dark,
                ),
            useMaterial3: true,
          ),
          initialRoute: '/connect',
          routes: {
            '/connect': (context) => const ConnectPage(),
            '/home': (context) => const HomePage(),
          },
        );
      },
    );
  }
}
