import 'package:flutter/material.dart';
import 'package:m3e_collection/m3e_collection.dart';

import '../services/secure_storage_service.dart';

class SplashPage extends StatefulWidget {
  const SplashPage({super.key});
  @override
  State<SplashPage> createState() => _SplashPageState();
}

class _SplashPageState extends State<SplashPage> {
  @override
  void initState() {
    super.initState();
    _redirect();
  }

  Future<void> _redirect() async {
    final loggedIn = await SecureStorageService().isLoggedIn();
    if (!mounted) return;
    Navigator.pushReplacementNamed(context, loggedIn ? '/' : '/connect');
  }

  @override
  Widget build(BuildContext context) {
    return const Scaffold(body: Center(child: LoadingIndicatorM3E()));
  }
}
