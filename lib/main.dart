import 'package:flutter/material.dart';
import 'package:dynamic_color/dynamic_color.dart';

import 'constants.dart';
import 'pages/error_page.dart';
import 'routes.dart';

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
          title: AppConstants.appTitle,
          debugShowCheckedModeBanner: false,
          theme: _buildLightTheme(lightDynamic),
          darkTheme: _buildDarkTheme(darkDynamic),

          themeMode: ThemeMode.system,
          initialRoute: AppRoutes.splash,
          onGenerateRoute: AppRoutes.generateRoute,
          onUnknownRoute: _handleUnknownRoute,
        );
      },
    );
  }

  ThemeData _buildLightTheme(ColorScheme? dynamic) => ThemeData(
    colorScheme: dynamic ?? ColorScheme.fromSeed(seedColor: Colors.orange),
    useMaterial3: true,
  );

  ThemeData _buildDarkTheme(ColorScheme? dynamic) => ThemeData(
    colorScheme: dynamic ?? ColorScheme.fromSeed(seedColor: Colors.cyan),
    useMaterial3: true,
  );

  static Route<dynamic> _handleUnknownRoute(RouteSettings settings) {
    return MaterialPageRoute(
      builder: (context) => ErrorPage(routeName: settings.name ?? 'unknown'),
    );
  }
}
