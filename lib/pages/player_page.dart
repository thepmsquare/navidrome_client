import 'package:flutter/material.dart';
import 'package:navidrome_client/services/api_service.dart';
import 'package:navidrome_client/components/player_view.dart';

class PlayerPage extends StatelessWidget {
  final ApiService apiService;

  const PlayerPage({super.key, required this.apiService});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: PlayerView(
        apiService: apiService,
        onMinimize: () => Navigator.of(context).pop(),
      ),
    );
  }
}
