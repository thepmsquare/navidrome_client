import 'dart:async';
import 'package:flutter/material.dart';
import 'package:navidrome_client/components/album_list_item.dart';
import 'package:navidrome_client/components/album_tile.dart';
import 'package:navidrome_client/components/playlist_list_item.dart';
import 'package:navidrome_client/components/track_list_item.dart';
import 'package:navidrome_client/components/mini_player.dart';
import 'package:navidrome_client/pages/player_page.dart';
import 'package:navidrome_client/pages/album_details_page.dart';
import 'package:navidrome_client/pages/playlist_details_page.dart';
import 'package:navidrome_client/services/api_service.dart';
import 'package:navidrome_client/services/player_service.dart';
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
  List<Map<String, dynamic>> _playlists = [];
  List<Map<String, dynamic>> _mostPlayedAlbums = [];
  List<Map<String, dynamic>> _randomTracks = [];
  bool _isLoading = true;
  bool _isLoadingPlaylists = false;
  bool _isLoadingHome = false;
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

  List<Map<String, dynamic>> get _playlistsToDisplay {
    List<Map<String, dynamic>> result = _playlists;
    if (_isOfflineMode) {
      result = result
          .where((p) => OfflineService().isPlaylistOfflineSync(p['id'].toString()))
          .toList();
    }
    if (_searchQuery.isNotEmpty) {
      final query = _searchQuery.toLowerCase();
      result = result
          .where((p) => (p['name'] ?? '').toString().toLowerCase().contains(query))
          .toList();
    }
    return result;
  }

  @override
  void initState() {
    super.initState();
    _initApiService().then((_) {
      _loadHomeContent();
      _loadAlbums();
      _loadPlaylists();
    });
    _scrollController.addListener(_onScroll);

    // #20: listen for auto-toggles
    OfflineService().offlineModeNotifier.addListener(_onOfflineModeChanged);
  }

  void _onOfflineModeChanged() {
    if (mounted) {
      setState(() {});
      // if it just went offline, make sure we show cached data
      if (OfflineService().isOfflineMode) {
        if (_albums.isEmpty) _loadFromCache();
        if (_playlists.isEmpty) _loadPlaylistsFromCache();
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

  Future<void> _loadHomeContent() async {
    if (_apiService == null || _isOfflineMode) return;

    setState(() { _isLoadingHome = true; });

    try {
      final results = await Future.wait([
        _apiService!.getAlbums(type: 'frequent', count: 20),
        _apiService!.getRandomSongs(count: 10),
      ]);

      if (mounted) {
        setState(() {
          _mostPlayedAlbums = results[0];
          _randomTracks = results[1];
          _isLoadingHome = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() { _isLoadingHome = false; });
      }
    }
  }

  Future<void> _refreshRandomTracks() async {
    if (_apiService == null || _isOfflineMode) return;
    try {
      final tracks = await _apiService!.getRandomSongs(count: 10);
      if (mounted) {
        setState(() {
          _randomTracks = tracks;
        });
      }
    } catch (e) {
      debugPrint('failed to refresh random tracks: $e');
    }
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

  Future<void> _loadPlaylistsFromCache() async {
    final cached = await OfflineService().getCachedPlaylistList();
    if (cached != null && mounted) {
      setState(() {
        _playlists = cached;
        _isLoadingPlaylists = false;
      });
    } else if (mounted) {
      setState(() { _isLoadingPlaylists = false; });
    }
  }

  Future<void> _loadPlaylists({bool refresh = false}) async {
    if (refresh) {
      if (mounted) {
        setState(() {
          _playlists = [];
          _isLoadingPlaylists = true;
        });
      }
    }

    if (_isOfflineMode && _apiService == null) {
      await _loadPlaylistsFromCache();
      return;
    }

    if (_apiService == null) return;

    try {
      final playlists = await _apiService!.getPlaylists();
      await OfflineService().savePlaylistListCache(playlists);

      if (mounted) {
        setState(() {
          _playlists = playlists;
          _isLoadingPlaylists = false;
        });
      }
    } catch (e) {
      if (_playlists.isEmpty) await _loadPlaylistsFromCache();
      if (mounted) {
        setState(() { _isLoadingPlaylists = false; });
      }
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
        if (_currentLibraryView == LibraryView.albums) {
          _loadAlbums(refresh: true);
        }
        // playlists search is local via getter
      }
    });
  }

  Future<void> _toggleOfflineMode(bool value) async {
    await OfflineService().setOfflineMode(value);
    // trigger rebuild — _isOfflineMode and _albumsToDisplay are getters
    // that reflect the new value immediately
    setState(() {});
    // if switching to offline with no content loaded from cache yet, load them
    if (value) {
      if (_albums.isEmpty) await _loadFromCache();
      if (_playlists.isEmpty) await _loadPlaylistsFromCache();
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
    if (_isLoadingHome && _mostPlayedAlbums.isEmpty && _randomTracks.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_isOfflineMode) {
      return const Center(child: Text('home content not available offline'));
    }

    return Scaffold(
      appBar: AppBar(title: const Text('home')),
      body: RefreshIndicator(
        onRefresh: _loadHomeContent,
        child: ListView(
          padding: const EdgeInsets.symmetric(vertical: 16),
          children: [
            // Most Played Section
            if (_mostPlayedAlbums.isNotEmpty) ...[
              _buildSectionHeader('most played'),
              const SizedBox(height: 12),
              SizedBox(
                height: 220,
                child: ListView.separated(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  scrollDirection: Axis.horizontal,
                  itemCount: _mostPlayedAlbums.length,
                  separatorBuilder: (context, index) => const SizedBox(width: 16),
                  itemBuilder: (context, index) {
                    final album = _mostPlayedAlbums[index];
                    return AlbumTile(
                      album: album,
                      apiService: _apiService!,
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (context) => AlbumDetailsPage(
                              album: album,
                              apiService: _apiService!,
                            ),
                          ),
                        );
                      },
                    );
                  },
                ),
              ),
              const SizedBox(height: 24),
            ],

            // Random Tracks Section
            if (_randomTracks.isNotEmpty) ...[
              _buildSectionHeader(
                'random tracks',
                trailing: IconButton(
                  icon: const Icon(Icons.refresh_rounded, size: 20),
                  onPressed: _refreshRandomTracks,
                ),
              ),
              const SizedBox(height: 8),
              ListView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                padding: EdgeInsets.zero,
                itemCount: _randomTracks.length,
                itemBuilder: (context, index) {
                  final track = _randomTracks[index];
                  final String? coverArtId = track['coverArt']?.toString();
                  final String? coverArtUrl = _apiService != null && coverArtId != null
                      ? _apiService!.getCoverArtUrl(coverArtId)
                      : null;

                  return TrackListItem(
                    track: track,
                    coverArtUrl: coverArtUrl,
                    apiService: _apiService,
                    onTap: () {
                      PlayerService().play(_randomTracks, index, _apiService!);
                    },
                  );
                },
              ),
              const SizedBox(height: 100), // padding for mini player
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildSectionHeader(String title, {Widget? trailing}) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            title,
            style: theme.textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.bold,
            ),
          ),
          if (trailing != null) trailing,
        ],
      ),
    );
  }

  Widget _buildLibraryView() {
    switch (_currentLibraryView) {
      case LibraryView.home:
        return _buildLibraryMenu();
      case LibraryView.albums:
        return _buildAlbumList();
      case LibraryView.playlists:
        return _buildPlaylistList();
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
            onTap: () {
              setState(() {
                _currentLibraryView = LibraryView.playlists;
              });
              _loadPlaylists();
            },
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

  Widget _buildPlaylistList() {
    final playlists = _playlistsToDisplay;

    return RefreshIndicator(
      onRefresh: () => _loadPlaylists(refresh: true),
      child: CustomScrollView(
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
                      hintText: 'search playlists...',
                      border: InputBorder.none,
                      hintStyle: TextStyle(color: Colors.grey),
                    ),
                    onChanged: _onSearchChanged,
                  )
                : const Text('playlists'),
            leading: IconButton(
              icon: Icon(_isSearchActive ? Icons.close_rounded : Icons.arrow_back_rounded),
              onPressed: () {
                if (_isSearchActive) {
                  setState(() {
                    _isSearchActive = false;
                    _searchQuery = '';
                    _searchController.clear();
                  });
                } else {
                  setState(() {
                    _currentLibraryView = LibraryView.home;
                  });
                }
              },
            ),
            actions: [
              if (!_isSearchActive)
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
          if (_isLoadingPlaylists && _playlists.isEmpty)
            const SliverFillRemaining(
              child: Center(child: CircularProgressIndicator()),
            )
          else if (playlists.isEmpty)
            SliverFillRemaining(
              child: Center(
                child: Text(
                  _isOfflineMode ? 'no downloaded playlists' : 'no playlists found',
                ),
              ),
            )
          else
            SliverPadding(
              padding: const EdgeInsets.only(top: 8, bottom: 100),
              sliver: SliverList(
                delegate: SliverChildBuilderDelegate(
                  (context, index) {
                    final playlist = playlists[index];
                    final coverArtId = playlist['coverArt'];
                    final String? coverArtUrl = _apiService != null && coverArtId != null
                        ? _apiService!.getCoverArtUrl(coverArtId)
                        : null;

                    return PlaylistListItem(
                      playlist: playlist,
                      coverArtUrl: coverArtUrl,
                      onTap: () {
                        final api = _apiService;
                        if (api == null) return;
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (context) => PlaylistDetailsPage(
                              playlist: playlist,
                              apiService: api,
                            ),
                          ),
                        );
                      },
                    );
                  },
                  childCount: playlists.length,
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
