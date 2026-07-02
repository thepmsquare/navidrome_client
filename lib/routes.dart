import 'package:flutter/material.dart';
import 'package:navidrome_client/pages/connect_page.dart';
import 'package:navidrome_client/pages/help_page.dart';
import 'package:navidrome_client/pages/home_page.dart';

class AppRoutes {
  static const String splash = '/';
  static const String connect = '/connect';
  static const String home = '/home';
  static const String help = '/help';

  static Route<dynamic>? generateRoute(RouteSettings settings, {required bool isLoggedIn}) {
    switch (settings.name) {
      case splash:
        return MaterialPageRoute(
          builder: (_) => isLoggedIn ? const HomePage() : const ConnectPage(),
          settings: settings,
        );
      case connect:
        return MaterialPageRoute(
          builder: (_) => const ConnectPage(),
          settings: settings,
        );
      case home:
        return MaterialPageRoute(
          builder: (_) => const HomePage(),
          settings: settings,
        );
      case help:
        return MaterialPageRoute(
          builder: (_) => const HelpPage(),
          settings: settings,
        );
      default:
        return null;
    }
  }
}
