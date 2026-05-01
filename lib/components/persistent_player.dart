import 'package:flutter/material.dart';
import 'package:miniplayer/miniplayer.dart';
import 'package:navidrome_client/components/mini_player_view.dart';
import 'package:navidrome_client/components/player_view.dart';
import 'package:navidrome_client/services/api_service.dart';
import 'package:navidrome_client/services/auth_service.dart';
import 'package:navidrome_client/services/player_service.dart';

class PersistentPlayer extends StatefulWidget {
  final Widget child;

  const PersistentPlayer({super.key, required this.child});

  @override
  State<PersistentPlayer> createState() => _PersistentPlayerState();
}

class _PersistentPlayerState extends State<PersistentPlayer> {
  final MiniplayerController _miniPlayerController = MiniplayerController();
  late final PageController _miniPlayerPageController;
  ApiService? _apiService;
  bool _isLoggedIn = false;

  @override
  void initState() {
    super.initState();
    _miniPlayerPageController = PageController(
      initialPage: PlayerService().player.currentIndex ?? 0,
    );
    _initApiService();
  }

  Future<void> _initApiService() async {
    final authService = AuthService();
    final url = await authService.serverUrl;
    final username = await authService.username;
    final password = await authService.password;
    final loggedIn = await authService.isLoggedIn;

    if (mounted) {
      setState(() {
        _isLoggedIn = loggedIn;
        if (url != null && username != null && password != null) {
          _apiService = ApiService(
            baseUrl: url,
            username: username,
            password: password,
          );
        }
      });
    }
  }

  @override
  void dispose() {
    _miniPlayerPageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Re-check login status if not logged in yet
    if (!_isLoggedIn) {
      _initApiService();
    }

    return Material(
      type: MaterialType.transparency,
      child: Stack(
        children: [
          widget.child,
          if (_isLoggedIn && _apiService != null)
            StreamBuilder<int?>(
              stream: PlayerService().currentIndexStream,
              builder: (context, snapshot) {
                final track = PlayerService().currentTrack;
                if (track == null) return const SizedBox.shrink();

                return Miniplayer(
                  controller: _miniPlayerController,
                  minHeight: 84, // 72 height + 12 bottom padding
                  maxHeight: MediaQuery.of(context).size.height,
                  builder: (height, percentage) {
                    final bool isMini = percentage < 0.2;
                    return AnimatedCrossFade(
                      duration: const Duration(milliseconds: 300),
                      crossFadeState: isMini
                          ? CrossFadeState.showFirst
                          : CrossFadeState.showSecond,
                      firstChild: Padding(
                        padding: const EdgeInsets.only(
                          left: 12,
                          right: 12,
                          bottom: 12,
                        ),
                        child: MiniPlayerView(
                          apiService: _apiService!,
                          pageController: _miniPlayerPageController,
                          onTap: () => _miniPlayerController.animateToHeight(
                            state: PanelState.MAX,
                          ),
                        ),
                      ),
                      secondChild: PlayerView(
                        apiService: _apiService!,
                        onMinimize: () => _miniPlayerController.animateToHeight(
                          state: PanelState.MIN,
                        ),
                      ),
                    );
                  },
                );
              },
            ),
        ],
      ),
    );
  }
}
