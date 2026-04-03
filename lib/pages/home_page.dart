import 'dart:async';
import 'package:flutter/material.dart';
import 'package:navidrome_client/components/album_list_item.dart';
import 'package:navidrome_client/components/mini_player.dart';
import 'package:navidrome_client/pages/player_page.dart';
import 'package:navidrome_client/pages/album_details_page.dart';
import 'package:navidrome_client/services/api_service.dart';
import 'package:navidrome_client/services/auth_service.dart';
import 'package:navidrome_client/services/offline_service.dart';

enum LibraryView { home, albums, playlists, tracks }

class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  final _authService = AuthService();
  final ScrollController _scrollController = ScrollController();
  int _selectedIndex = 1; // default to Library per user preference

  List<Map<String, dynamic>> _albums = [];
  bool _isLoading = true;
  bool _isFetchingMore = false;
  bool _hasMore = true;
  int _offset = 0;
  final int _limit = 50;
  LibraryView _currentLibraryView = LibraryView.home;
  ApiService? _apiService;

  final TextEditingController _searchController = TextEditingController();
  bool _isSearchActive = false;
  String _searchQuery = '';
  Timer? _debounce;

  // #7/#4: read synchronously from in-memory state after initialize()
  bool get _isOfflineMode => OfflineService().isOfflineMode;

  // #4: computed once per state change, not inside the item builder
  List<Map<String, dynamic>> get _albumsToDisplay {
    if (!_isOfflineMode) return _albums;
    return _albums
        .where((a) => OfflineService().isAlbumOfflineSync(a['id'].toString()))
        .toList();
  }

  @override
  void initState() {
    super.initState();
    _initApiService().then((_) => _loadAlbums());
    _scrollController.addListener(_onScroll);

    // #20: listen for auto-toggles
    OfflineService().offlineModeNotifier.addListener(_onOfflineModeChanged);
  }

  void _onOfflineModeChanged() {
    if (mounted) {
      setState(() {});
      // if it just went offline, make sure we show cached data
      if (OfflineService().isOfflineMode && _albums.isEmpty) {
        _loadFromCache();
      }
    }
  }

  @override
  void dispose() {
    _scrollController.dispose();
    _searchController.dispose();
    _debounce?.cancel();
    OfflineService().offlineModeNotifier.removeListener(_onOfflineModeChanged);
    super.dispose();
  }

  Future<void> _initApiService() async {
    final url = await _authService.serverUrl;
    final username = await _authService.username;
    final password = await _authService.password;

    if (url != null && username != null && password != null) {
      if (mounted) {
        setState(() {
          _apiService = ApiService(baseUrl: url, username: username, password: password);
        });
      }
    }
  }

  Future<void> _loadAlbums({bool refresh = false}) async {
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

    // #9: if offline mode and no API service, load from local album list cache
    if (_isOfflineMode && _apiService == null) {
      await _loadFromCache();
      return;
    }

    if (_apiService == null) return;

    try {
      final newAlbums = _searchQuery.isEmpty
          ? await _apiService!.getAlbums(count: _limit, offset: _offset)
          : await _apiService!.searchAlbums(_searchQuery, count: _limit, offset: _offset);
      
      // #9: cache on every successful page 1 load so we always have fresh data
      if (_offset == 0 || refresh) {
        await OfflineService().saveAlbumListCache(newAlbums);
      }

      if (mounted) {
        setState(() {
          _albums.addAll(newAlbums);
          _isLoading = false;
          _isFetchingMore = false;
          _offset += newAlbums.length;
          if (newAlbums.length < _limit) _hasMore = false;
        });
      }
    } catch (e) {
      // #9: on network failure, try loading from local cache
      if (_albums.isEmpty) await _loadFromCache();
      if (mounted) {
        setState(() {
          _isLoading = false;
          _isFetchingMore = false;
        });
        if (_albums.isEmpty) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('failed to load albums: ${e.toString()}')),
          );
        }
      }
    }
  }

  /// #9: populate _albums from the local JSON cache
  Future<void> _loadFromCache() async {
    final cached = await OfflineService().getCachedAlbumList();
    if (cached != null && mounted) {
      setState(() {
        _albums = cached;
        _isLoading = false;
        _hasMore = false;
      });
    } else if (mounted) {
      setState(() { _isLoading = false; });
    }
  }

  void _onScroll() {
    if (!_scrollController.hasClients) return;
    if (_scrollController.position.pixels >= _scrollController.position.maxScrollExtent - 200) {
      if (!_isFetchingMore && _hasMore && !_isOfflineMode) {
        if (mounted) {
          setState(() { _isFetchingMore = true; });
          _loadAlbums();
        }
      }
    }
  }

  Future<void> _handleLogout() async {
    await _authService.logout();
    if (mounted) Navigator.pushReplacementNamed(context, '/connect');
  }

  void _onSearchChanged(String query) {
    if (_debounce?.isActive ?? false) _debounce!.cancel();
    _debounce = Timer(const Duration(milliseconds: 500), () {
      if (mounted) {
        setState(() {
          _searchQuery = query;
        });
        _loadAlbums(refresh: true);
      }
    });
  }

  Future<void> _toggleOfflineMode(bool value) async {
    await OfflineService().setOfflineMode(value);
    // trigger rebuild — _isOfflineMode and _albumsToDisplay are getters
    // that reflect the new value immediately
    setState(() {});
    // if switching to offline with no albums loaded from cache yet, load them
    if (value && _albums.isEmpty) await _loadFromCache();
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
          if (index == 1 && _selectedIndex == 1) {
            setState(() { _currentLibraryView = LibraryView.home; });
          } else {
            setState(() { _selectedIndex = index; });
          }
        },
        destinations: const [
          NavigationDestination(icon: Icon(Icons.home_rounded), label: 'home'),
          NavigationDestination(icon: Icon(Icons.library_music_rounded), label: 'library'),
          NavigationDestination(icon: Icon(Icons.settings_rounded), label: 'settings'),
        ],
      ),
    );
  }

  Widget _buildHomeView() {
    return const Scaffold(
      body: Center(child: Text('welcome home')),
    );
  }

  Widget _buildLibraryView() {
    switch (_currentLibraryView) {
      case LibraryView.home:
        return _buildLibraryMenu();
      case LibraryView.albums:
        return _buildAlbumList();
      default:
        return _buildLibraryMenu();
    }
  }

  Widget _buildLibraryMenu() {
    return Scaffold(
      appBar: AppBar(title: const Text('library')),
      body: ListView(
        children: [
          ListTile(
            leading: const Icon(Icons.playlist_play_rounded),
            title: const Text('playlists'),
            onTap: () {}, // "does nothing for now"
          ),
          ListTile(
            leading: const Icon(Icons.audiotrack_rounded),
            title: const Text('tracks'),
            onTap: () {}, // "does nothing for now"
          ),
          ListTile(
            leading: const Icon(Icons.album_rounded),
            title: const Text('albums'),
            onTap: () {
              setState(() {
                _currentLibraryView = LibraryView.albums;
              });
            },
          ),
        ],
      ),
    );
  }

  Widget _buildAlbumList() {
    // #4: compute filtered list once, not inside SliverChildBuilderDelegate
    final albums = _albumsToDisplay;

    return RefreshIndicator(
      onRefresh: () => _loadAlbums(refresh: true),
      child: CustomScrollView(
        controller: _scrollController,
        slivers: [
          SliverAppBar.large(
            title: _isSearchActive
                ? TextField(
                    controller: _searchController,
                    autofocus: true,
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.onSurface,
                      fontSize: 18,
                    ),
                    decoration: const InputDecoration(
                      hintText: 'search albums...',
                      border: InputBorder.none,
                      hintStyle: TextStyle(color: Colors.grey),
                    ),
                    onChanged: _onSearchChanged,
                  )
                : const Text('albums'),
            leading: IconButton(
              icon: Icon(_isSearchActive ? Icons.close_rounded : Icons.arrow_back_rounded),
              onPressed: () {
                if (_isSearchActive) {
                  setState(() {
                    _isSearchActive = false;
                    _searchQuery = '';
                    _searchController.clear();
                  });
                  _loadAlbums(refresh: true);
                } else {
                  setState(() {
                    _currentLibraryView = LibraryView.home;
                  });
                }
              },
            ),
            actions: [
              if (!_isSearchActive && !_isOfflineMode)
                IconButton(
                  icon: const Icon(Icons.search_rounded),
                  onPressed: () {
                    setState(() {
                      _isSearchActive = true;
                    });
                  },
                ),
            ],
          ),
          if (_isLoading && _albums.isEmpty)
            const SliverFillRemaining(
              child: Center(child: CircularProgressIndicator()),
            )
          else if (albums.isEmpty)
            SliverFillRemaining(
              child: Center(
                child: Text(
                  _isOfflineMode ? 'no downloaded albums' : 'no albums found',
                ),
              ),
            )
          else
            SliverPadding(
              padding: const EdgeInsets.only(top: 8, bottom: 100),
              sliver: SliverList(
                delegate: SliverChildBuilderDelegate(
                  (context, index) {
                    // loading footer
                    if (index == albums.length) {
                      return (_hasMore && !_isOfflineMode)
                          ? const Padding(
                              padding: EdgeInsets.all(32.0),
                              child: Center(child: CircularProgressIndicator()),
                            )
                          : const SizedBox.shrink();
                    }

                    final album = albums[index];
                    final coverArtId = album['coverArt'];
                    final String? coverArtUrl = _apiService != null && coverArtId != null
                        ? _apiService!.getCoverArtUrl(coverArtId)
                        : null;

                    return AlbumListItem(
                      album: album,
                      coverArtUrl: coverArtUrl,
                      onTap: () {
                        // when offline and no api service, still open the page
                        // AlbumDetailsPage will use cached metadata
                        final api = _apiService;
                        if (api == null) return;
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (context) => AlbumDetailsPage(
                              album: album,
                              apiService: api,
                            ),
                          ),
                        );
                      },
                    );
                  },
                  childCount: albums.length + ((_hasMore && !_isOfflineMode) ? 1 : 0),
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
      appBar: AppBar(title: const Text('settings')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: SwitchListTile(
              secondary: const Icon(Icons.offline_pin_rounded),
              title: const Text('offline mode'),
              subtitle: const Text('only show downloaded content'),
              value: _isOfflineMode,
              onChanged: _toggleOfflineMode,
            ),
          ),
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
