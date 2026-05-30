// routes.dart
import 'pages/connect_page.dart';
import 'pages/home.dart';

class AppRoutes {
  static const connect = '/connect';
  static const home = '/';

  static final routes = {
    connect: (context) => const MyConnectPage(title: 'Connect Page'),
    home: (context) => const MyHomePage(title: 'Home Page'),
  };
}
