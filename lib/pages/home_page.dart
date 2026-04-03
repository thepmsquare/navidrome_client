import 'package:flutter/material.dart';
import 'package:navidrome_client/components/album_list_item.dart';
import 'package:navidrome_client/components/mini_player.dart';
import 'package:navidrome_client/pages/player_page.dart';
import 'package:navidrome_client/pages/album_details_page.dart';
import 'package:navidrome_client/services/api_service.dart';
import 'package:navidrome_client/services/auth_service.dart';

class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  final _authService = AuthService();
  final ScrollController _scrollController = ScrollController();
  int _selectedIndex = 1; // Default to Library per user preference
  
  List<Map<String, dynamic>> _albums = [];
  bool _isLoading = true;
  bool _isFetchingMore = false;
  bool _hasMore = true;
  int _offset = 0;
  final int _limit = 50;
  ApiService? _apiService;

  @override
  void initState() {
    super.initState();
    _initApiService().then((_) => _loadAlbums());
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _initApiService() async {
    final url = await _authService.serverUrl;
    final username = await _authService.username;
    final password = await _authService.password;

    if (url != null && username != null && password != null) {
      if (mounted) {
        setState(() {
          _apiService = ApiService(
            baseUrl: url,
            username: username,
            password: password,
          );
        });
      }
    }
  }

  Future<void> _loadAlbums({bool refresh = false}) async {
    if (_apiService == null) return;
    if (refresh) {
      if (mounted) {
        setState(() {
          _offset = 0;
          _albums = [];
          _hasMore = true;
          _isLoading = true;
        });
      }
    }

    try {
      final newAlbums = await _apiService!.getAlbums(count: _limit, offset: _offset);
      if (mounted) {
        setState(() {
          _albums.addAll(newAlbums);
          _isLoading = false;
          _isFetchingMore = false;
          _offset += newAlbums.length;
          if (newAlbums.length < _limit) {
            _hasMore = false;
          }
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _isFetchingMore = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          // note: we are preserving the original case from the api for error messages.
          SnackBar(content: Text('failed to load albums: ${e.toString()}')),
        );
      }
    }
  }

  void _onScroll() {
    if (_scrollController.hasClients) {
      if (_scrollController.position.pixels >= _scrollController.position.maxScrollExtent - 200) {
        if (!_isFetchingMore && _hasMore) {
          if (mounted) {
            setState(() {
              _isFetchingMore = true;
            });
            _loadAlbums();
          }
        }
      }
    }
  }

  Future<void> _handleLogout() async {
    await _authService.logout();
    if (mounted) {
      Navigator.pushReplacementNamed(context, '/connect');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          IndexedStack(
            index: _selectedIndex,
            children: [
              _buildHomeView(),
              _buildLibraryView(),
              _buildSettingsView(),
            ],
          ),
          if (_apiService != null)
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: MiniPlayer(
                apiService: _apiService!,
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (context) => PlayerPage(apiService: _apiService!),
                      fullscreenDialog: true,
                    ),
                  );
                },
              ),
            ),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _selectedIndex,
        onDestinationSelected: (index) {
          setState(() {
            _selectedIndex = index;
          });
        },
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.home_rounded),
            label: 'home',
          ),
          NavigationDestination(
            icon: Icon(Icons.library_music_rounded),
            label: 'library',
          ),
          NavigationDestination(
            icon: Icon(Icons.settings_rounded),
            label: 'settings',
          ),
        ],
      ),
    );
  }

  Widget _buildHomeView() {
    return const Scaffold(
      body: Center(
        child: Text('welcome home'),
      ),
    );
  }

  Widget _buildLibraryView() {
    return RefreshIndicator(
      onRefresh: () => _loadAlbums(refresh: true),
      child: CustomScrollView(
        controller: _scrollController,
        slivers: [
          const SliverAppBar.large(
            title: Text('library'),
          ),
          if (_isLoading && _albums.isEmpty)
            const SliverFillRemaining(
              child: Center(child: CircularProgressIndicator()),
            )
          else if (_albums.isEmpty)
            const SliverFillRemaining(
              child: Center(child: Text('no albums found')),
            )
          else
            SliverPadding(
              padding: const EdgeInsets.only(top: 8, bottom: 100),
              sliver: SliverList(
                delegate: SliverChildBuilderDelegate(
                  (context, index) {
                    if (index == _albums.length) {
                      return const Padding(
                        padding: EdgeInsets.all(32.0),
                        child: Center(child: CircularProgressIndicator()),
                      );
                    }
                    final album = _albums[index];
                    final coverArtId = album['coverArt'];
                    final String? coverArtUrl = _apiService != null && coverArtId != null
                        ? _apiService!.getCoverArtUrl(coverArtId)
                        : null;

                    return AlbumListItem(
                      album: album,
                      coverArtUrl: coverArtUrl,
                      onTap: () {
                        if (_apiService != null) {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (context) => AlbumDetailsPage(
                                album: album,
                                apiService: _apiService!,
                              ),
                            ),
                          );
                        }
                      },
                    );
                  },
                  childCount: _albums.length + (_hasMore ? 1 : 0),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildSettingsView() {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Scaffold(
      appBar: AppBar(
        title: const Text('settings'),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: ListTile(
              leading: const Icon(Icons.logout_rounded),
              title: const Text('logout'),
              subtitle: const Text('sign out of your navidrome server'),
              onTap: _handleLogout,
              textColor: colorScheme.error,
              iconColor: colorScheme.error,
            ),
          ),
        ],
      ),
    );
  }
}
