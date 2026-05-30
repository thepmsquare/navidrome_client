import 'package:flutter/material.dart';
import 'pages/connect_page.dart';
import 'pages/home.dart';
import 'pages/splash_page.dart';
import 'pages/error_page.dart';
import 'services/secure_storage_service.dart';

class AppRoutes {
  static const connect = '/connect';
  static const home = '/';
  static const splash = '/splash';

  static const _protected = {home};

  static final _builders = <String, WidgetBuilder>{
    splash: (_) => const SplashPage(),
    connect: (_) => const MyConnectPage(title: 'Connect Page'),
    home: (_) => const MyHomePage(title: 'Home Page'),
  };

  static Route<dynamic> generateRoute(RouteSettings settings) {
    final isProtected = _protected.contains(settings.name);
    final isLoggedIn = SecureStorageService().isLoggedInSync;

    if (isProtected && !isLoggedIn) {
      return MaterialPageRoute(
        builder: (_) => const MyConnectPage(title: 'Connect Page'),
        settings: const RouteSettings(name: connect),
      );
    }

    final builder = _builders[settings.name];
    if (builder != null) {
      return MaterialPageRoute(builder: builder, settings: settings);
    }

    return MaterialPageRoute(
      builder: (_) => ErrorPage(routeName: settings.name ?? 'unknown'),
    );
  }
}
