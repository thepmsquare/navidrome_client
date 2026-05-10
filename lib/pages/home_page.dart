import 'dart:async';
import 'dart:io' show Platform;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:navidrome_client/components/album_list_item.dart';
import 'package:navidrome_client/components/album_tile.dart';
import 'package:navidrome_client/components/track_list_item.dart';
import 'package:navidrome_client/pages/album_details_page.dart';
import 'package:navidrome_client/services/api_service.dart';
import 'package:navidrome_client/services/player_service.dart';
import 'package:navidrome_client/services/auth_service.dart';
import 'package:navidrome_client/services/offline_service.dart';
import 'package:navidrome_client/components/offline_indicator.dart';
import 'package:navidrome_client/services/session_service.dart';
import 'package:navidrome_client/pages/albums_page.dart';
import 'package:navidrome_client/pages/tracks_page.dart';
import 'package:navidrome_client/pages/playlists_page.dart';
import 'package:navidrome_client/pages/artists_page.dart';
import 'package:navidrome_client/pages/artist_details_page.dart';
import 'package:miniplayer/miniplayer.dart';
import 'package:navidrome_client/components/mini_player_view.dart';
import 'package:navidrome_client/components/player_view.dart';
import 'package:navidrome_client/pages/settings/settings_page.dart';
import 'package:navidrome_client/pages/sync_page.dart';

import 'package:navidrome_client/services/version_service.dart';

enum LibraryView { home, albums, playlists, tracks, artists }

enum TrackSortOrder {
  name,
  artist,
  album,
  rating,
  year,
  duration,
  genre,
  playCount,
  dateAdded,
  lastPlayed,
  bitRate,
}

class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  final _authService = AuthService();
  final _sessionService = SessionService();
  // final ScrollController _scrollController = ScrollController();
  int _selectedIndex = 0; // default to Home per user's "first time" request

  List<Map<String, dynamic>> _mostPlayedAlbums = [];
  List<Map<String, dynamic>> _randomTracks = [];
  bool _isLoadingHome = false;
  // bool _isFetchingMore = false;
  ApiService? _apiService;

  final TextEditingController _universalSearchController =
      TextEditingController();
  final FocusNode _universalSearchFocusNode = FocusNode();
  Timer? _debounce;

  List<Map<String, dynamic>> _universalSearchArtists = [];
  List<Map<String, dynamic>> _universalSearchAlbums = [];
  List<Map<String, dynamic>> _universalSearchTracks = [];
  bool _isUniversalSearching = false;

  final List<GlobalKey<NavigatorState>> _navigatorKeys = [
    GlobalKey<NavigatorState>(),
    GlobalKey<NavigatorState>(),
    GlobalKey<NavigatorState>(),
    GlobalKey<NavigatorState>(),
    GlobalKey<NavigatorState>(),
  ];

  // #7/#4: read synchronously from in-memory state after initialize()
  bool get _isOfflineMode => OfflineService().isOfflineMode;

  final MiniplayerController _miniPlayerController = MiniplayerController();
  static const double _miniPlayerHeight = 84;
  final ValueNotifier<double> _playerExpandProgress = ValueNotifier(0.0);

  @override
  void initState() {
    super.initState();
    // run init and session load in parallel for faster startup
    Future.wait([_initApiService(), _loadSessionState()]).then((_) {
      _loadHomeContent();
      // restore playback session once API is ready
      if (_apiService != null) {
        PlayerService().restoreSession(_apiService!);
      }
      if (mounted) {
        VersionService().checkAndShowGreeting(context);
      }
    });

    // #20: listen for auto-toggles
    OfflineService().offlineModeNotifier.addListener(_onOfflineModeChanged);
    OfflineService().addListener(_onOfflineCompletion);
  }

  void _onOfflineCompletion() {
    if (!mounted) return;
    // Only rebuild the whole page if we are in offline mode (to filter the list).
    // Individual items (TrackListItem, etc.) already handle their own icons via listeners.
    if (OfflineService().isOfflineMode) {
      setState(() {
        // intentional: triggers rebuild to re-evaluate _isOfflineMode getter
      });
    }
  }

  void _onOfflineModeChanged() {
    if (!mounted) return;
    // only rebuild if the selected tab cares about offline state (home or library)
    if (_selectedIndex <= 1) {
      setState(() {
        // intentional: triggers rebuild to re-evaluate _isOfflineMode getter
      });
    }
  }

  Future<void> _loadSessionState() async {
    final isFirstRun = await _sessionService.isFirstRun;
    if (!isFirstRun) {
      final tabIndex = await _sessionService.lastTabIndex;

      if (mounted) {
        setState(() {
          _selectedIndex = tabIndex;
        });
      }
    } else {
      // mark first run as complete after first render
      await _sessionService.setNotFirstRun();
    }
  }

  @override
  void dispose() {
    _universalSearchController.dispose();
    _universalSearchFocusNode.dispose();
    _debounce?.cancel();
    OfflineService().offlineModeNotifier.removeListener(_onOfflineModeChanged);
    OfflineService().removeListener(_onOfflineCompletion);
    super.dispose();
  }

  Future<void> _loadHomeContent() async {
    if (_apiService == null || _isOfflineMode) return;

    setState(() {
      _isLoadingHome = true;
    });

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
        setState(() {
          _isLoadingHome = false;
        });
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
          _apiService = ApiService(
            baseUrl: url,
            username: username,
            password: password,
          );
        });
      }
    }
  }


  void _onUniversalSearchChanged(String query) {
    if (_debounce?.isActive ?? false) _debounce!.cancel();
    if (query.isEmpty) {
      setState(() {
        _universalSearchArtists = [];
        _universalSearchAlbums = [];
        _universalSearchTracks = [];
        _isUniversalSearching = false;
      });
      return;
    }

    _debounce = Timer(const Duration(milliseconds: 500), () {
      _performUniversalSearch(query);
    });
  }

  Future<void> _performUniversalSearch(String query) async {
    if (_apiService == null || _isOfflineMode) return;

    setState(() {
      _isUniversalSearching = true;
    });

    try {
      final results = await _apiService!.searchAll(query);
      if (mounted) {
        setState(() {
          _universalSearchArtists = results['artists']!;
          _universalSearchAlbums = results['albums']!;
          _universalSearchTracks = results['songs']!;
          _isUniversalSearching = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isUniversalSearching = false;
        });
      }
    }
  }

  Future<void> _toggleOfflineMode(bool value) async {
    await OfflineService().setOfflineMode(value);
    // trigger rebuild — _isOfflineMode reflecting new value immediately
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) async {
        if (didPop) return;

        // 1. handle search closure
        if (_selectedIndex == 2 && _universalSearchController.text.isNotEmpty) {
          setState(() {
            _universalSearchController.clear();
            _onUniversalSearchChanged('');
          });
          return;
        }

        // 2. handle nested navigators
        final navigator = _navigatorKeys[_selectedIndex].currentState;
        if (navigator != null && navigator.canPop()) {
          navigator.pop();
          return;
        }

        // 3. handle tab switching
        if (_selectedIndex != 0) {
          setState(() {
            _selectedIndex = 0;
          });
          _sessionService.setLastTabIndex(0);
          return;
        }

        // 4. exit
        SystemNavigator.pop();
      },
      child: Scaffold(
        body: Stack(
          children: [
            Column(
              children: [
                const OfflineIndicator(),
                Expanded(
                  child: IndexedStack(
                    index: _selectedIndex,
                    children: List.generate(5, (index) {
                      return Navigator(
                        key: _navigatorKeys[index],
                        onGenerateRoute: (settings) {
                          return MaterialPageRoute(
                            builder: (context) {
                              switch (index) {
                                case 0:
                                  return _buildHomeView();
                                case 1:
                                  return _buildLibraryView();
                                case 2:
                                  return _buildSearchView();
                                case 3:
                                  return _buildSyncView();
                                case 4:
                                  return _buildSettingsView();
                                default:
                                  return const SizedBox.shrink();
                              }
                            },
                          );
                        },
                      );
                    }),
                  ),
                ),
              ],
            ),
            if (_apiService != null)
              StreamBuilder<int?>(
                stream: PlayerService().currentIndexStream,
                builder: (context, snapshot) {
                  final track = PlayerService().currentTrack;
                  if (track == null) return const SizedBox.shrink();

                  final maxH = MediaQuery.of(context).size.height;

                  return Miniplayer(
                    controller: _miniPlayerController,
                    minHeight: _miniPlayerHeight,
                    maxHeight: maxH,
                    builder: (height, percentage) {
                      // Update expansion progress for hiding bottom nav
                      Future.microtask(() {
                        if (mounted) _playerExpandProgress.value = percentage;
                      });

                      // Full player slides up to follow the mini player's bottom edge.
                      final slideY = _miniPlayerHeight * (1.0 - percentage);

                      // Mini player slides up and out as the panel expands.
                      final miniSlideY = -percentage * _miniPlayerHeight;

                      return Stack(
                        clipBehavior: Clip.hardEdge,
                        children: [
                          // Full player — always in tree, slides in from below.
                          IgnorePointer(
                            ignoring: percentage < 0.5,
                            child: Transform.translate(
                              offset: Offset(0, slideY),
                              child: OverflowBox(
                                minHeight: maxH,
                                maxHeight: maxH,
                                alignment: Alignment.topCenter,
                                child: PlayerView(
                                  apiService: _apiService!,
                                  onMinimize: () => _miniPlayerController
                                      .animateToHeight(state: PanelState.MIN),
                                ),
                              ),
                            ),
                          ),
                          // Mini player — slides up the top as expansion happens.
                          Positioned(
                            top: 0,
                            left: 0,
                            right: 0,
                            height: _miniPlayerHeight,
                            child: Transform.translate(
                              offset: Offset(0, miniSlideY),
                              child: Padding(
                                padding: const EdgeInsets.only(
                                  left: 12,
                                  right: 12,
                                  bottom: 12,
                                ),
                                child: MiniPlayerView(
                                  apiService: _apiService!,
                                  onTap: () =>
                                      _miniPlayerController.animateToHeight(
                                        state: PanelState.MAX,
                                      ),
                                ),
                              ),
                            ),
                          ),
                        ],
                      );

                    },
                  );
                },
              ),
          ],
        ),
        bottomNavigationBar: ValueListenableBuilder<double>(
          valueListenable: _playerExpandProgress,
          builder: (context, value, child) {
            // Hide the navigation bar as soon as the player starts expanding
            if (value > 0.05) return const SizedBox.shrink();

            return NavigationBar(
              selectedIndex: _selectedIndex,
              onDestinationSelected: (index) {
                if (index == _selectedIndex) {
                  _navigatorKeys[index].currentState?.popUntil((r) => r.isFirst);
                } else {
                  setState(() => _selectedIndex = index);
                  _sessionService.setLastTabIndex(index);
                }
                if (index == 2) {
                  WidgetsBinding.instance.addPostFrameCallback((_) {
                    if (mounted) _universalSearchFocusNode.requestFocus();
                  });
                }
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
                  icon: Icon(Icons.search_rounded),
                  label: 'search',
                ),
                NavigationDestination(
                  icon: Icon(Icons.sync_rounded),
                  label: 'sync',
                ),
                NavigationDestination(
                  icon: Icon(Icons.settings_rounded),
                  label: 'settings',
                ),
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _buildHomeView() {
    return Builder(
      builder: (context) {
        if (_isLoadingHome &&
            _mostPlayedAlbums.isEmpty &&
            _randomTracks.isEmpty) {
          return const Center(child: CircularProgressIndicator());
        }

        if (_isOfflineMode) {
          return const Center(
            child: Text('home content not available offline'),
          );
        }

        return Column(
          children: [
            AppBar(title: const Text('home'), primary: !_isOfflineMode),
            Expanded(
              child: RefreshIndicator(
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
                          separatorBuilder: (context, index) =>
                              const SizedBox(width: 16),
                          itemBuilder: (context, index) {
                            final album = _mostPlayedAlbums[index];
                            final heroTag = 'most_played_${album['id']}';
                            return AlbumTile(
                              album: album,
                              apiService: _apiService!,
                              heroTag: heroTag,
                              onTap: () {
                                Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (context) => AlbumDetailsPage(
                                      album: album,
                                      apiService: _apiService!,
                                      heroTag: heroTag,
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
                          final String? coverArtId = track['coverArt']
                              ?.toString();
                          final String? coverArtUrl =
                              _apiService != null && coverArtId != null
                              ? _apiService!.getCoverArtUrl(coverArtId)
                              : null;

                          return TrackListItem(
                            track: track,
                            coverArtUrl: coverArtUrl,
                            apiService: _apiService,
                            onTap: () {
                              PlayerService().play(
                                _randomTracks,
                                index,
                                _apiService!,
                              );
                            },
                          );
                        },
                      ),
                      const SizedBox(height: 100), // padding for mini player
                    ],
                  ],
                ),
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _buildSearchView() {
    return Builder(
      builder: (context) {
        return CustomScrollView(
          slivers: [
            SliverAppBar.large(
              title: const Text('search'),
              primary: !_isOfflineMode,
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: TextField(
                  controller: _universalSearchController,
                  focusNode: _universalSearchFocusNode,
                  autofocus: true,
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.onSurface,
                    fontSize: 18,
                  ),
                  decoration: const InputDecoration(
                    hintText: 'search artists, albums, tracks...',
                    prefixIcon: Icon(Icons.search_rounded),
                  ),
                  onChanged: _onUniversalSearchChanged,
                ),
              ),
            ),
            if (_isOfflineMode)
              const SliverFillRemaining(
                child: Center(child: Text('search is not available offline')),
              )
            else if (_isUniversalSearching)
              const SliverFillRemaining(
                child: Center(child: CircularProgressIndicator()),
              )
            else if (_universalSearchArtists.isEmpty &&
                _universalSearchAlbums.isEmpty &&
                _universalSearchTracks.isEmpty)
              const SliverFillRemaining(
                child: Center(child: Text('search for your favorite music')),
              )
            else
              SliverPadding(
                padding: const EdgeInsets.only(bottom: 100),
                sliver: SliverList(
                  delegate: SliverChildListDelegate([
                    if (_universalSearchArtists.isNotEmpty) ...[
                      _buildSectionHeader('artists'),
                      ..._universalSearchArtists.map(
                        (artist) => ListTile(
                          leading: const CircleAvatar(
                            child: Icon(Icons.person_rounded),
                          ),
                          title: Text(
                            artist['name']?.toString() ?? 'unknown artist',
                          ),
                          onTap: () {
                            if (_apiService == null) return;
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (context) => ArtistDetailsPage(
                                  artist: artist,
                                  apiService: _apiService!,
                                ),
                              ),
                            ).then((_) {
                              if (mounted && _selectedIndex == 2) {
                                _universalSearchFocusNode.requestFocus();
                              }
                            });
                          },
                        ),
                      ),
                    ],
                    if (_universalSearchAlbums.isNotEmpty) ...[
                      _buildSectionHeader('albums'),
                      ..._universalSearchAlbums.map((album) {
                        final coverArtId = album['coverArt'];
                        final String? coverArtUrl =
                            _apiService != null && coverArtId != null
                            ? _apiService!.getCoverArtUrl(coverArtId)
                            : null;
                        final heroTag = 'search_album_${album['id']}';
                        return AlbumListItem(
                          album: album,
                          coverArtUrl: coverArtUrl,
                          heroTag: heroTag,
                          onTap: () {
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (context) => AlbumDetailsPage(
                                  album: album,
                                  apiService: _apiService!,
                                  heroTag: heroTag,
                                ),
                              ),
                            ).then((_) {
                              if (mounted && _selectedIndex == 2) {
                                _universalSearchFocusNode.requestFocus();
                              }
                            });
                          },
                        );
                      }),
                    ],
                    if (_universalSearchTracks.isNotEmpty) ...[
                      _buildSectionHeader('tracks'),
                      ..._universalSearchTracks.asMap().entries.map((entry) {
                        final index = entry.key;
                        final track = entry.value;
                        final coverArtId = track['coverArt'];
                        final String? coverArtUrl =
                            _apiService != null && coverArtId != null
                            ? _apiService!.getCoverArtUrl(coverArtId)
                            : null;
                        return TrackListItem(
                          track: track,
                          coverArtUrl: coverArtUrl,
                          apiService: _apiService,
                          onTap: () {
                            PlayerService().play(
                              _universalSearchTracks,
                              index,
                              _apiService!,
                            );
                          },
                        );
                      }),
                    ],
                  ]),
                ),
              ),
          ],
        );
      },
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
    return _buildLibraryMenu();
  }

  Widget _buildLibraryMenu() {
    return Builder(
      builder: (context) {
        return Column(
          children: [
            AppBar(title: const Text('library'), primary: !_isOfflineMode),
            Expanded(
              child: ListView(
                children: [
                  ListTile(
                    leading: const Icon(Icons.playlist_play_rounded),
                    title: const Text('playlists'),
                    onTap: () {
                      if (_apiService == null) return;
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (context) =>
                              PlaylistsPage(apiService: _apiService!),
                        ),
                      );
                    },
                  ),
                  ListTile(
                    leading: const Icon(Icons.audiotrack_rounded),
                    title: const Text('tracks'),
                    onTap: () {
                      if (_apiService == null) return;
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (context) =>
                              TracksPage(apiService: _apiService!),
                        ),
                      );
                    },
                  ),
                  ListTile(
                    leading: const Icon(Icons.album_rounded),
                    title: const Text('albums'),
                    onTap: () {
                      if (_apiService == null) return;
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (context) =>
                              AlbumsPage(apiService: _apiService!),
                        ),
                      );
                    },
                  ),
                  ListTile(
                    leading: const Icon(Icons.person_rounded),
                    title: const Text('artists'),
                    onTap: () {
                      if (_apiService == null) return;
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (context) =>
                              ArtistsPage(apiService: _apiService!),
                        ),
                      );
                    },
                  ),
                  const SizedBox(height: 100),
                ],
              ),
            ),
          ],
        );
      },
    );
  }

  // Old builders removed

  Widget _buildSyncView() {
    return const SyncPage();
  }

  Widget _buildSettingsView() {
    return const SettingsPage();
  }
}
