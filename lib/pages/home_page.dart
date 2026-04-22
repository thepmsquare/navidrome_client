import 'dart:async';
import 'dart:io' show Platform;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:navidrome_client/components/album_list_item.dart';
import 'package:navidrome_client/components/album_tile.dart';
import 'package:navidrome_client/components/track_list_item.dart';
import 'package:navidrome_client/components/mini_player.dart';
import 'package:navidrome_client/utils/disk_utility.dart';
import 'package:navidrome_client/pages/player_page.dart';
import 'package:navidrome_client/pages/album_details_page.dart';
import 'package:navidrome_client/pages/event_log_page.dart';
import 'package:navidrome_client/services/api_service.dart';
import 'package:navidrome_client/services/event_log_service.dart';
import 'package:navidrome_client/services/player_service.dart';
import 'package:navidrome_client/services/auth_service.dart';
import 'package:navidrome_client/services/offline_service.dart';
import 'package:navidrome_client/components/offline_indicator.dart';
import 'package:navidrome_client/services/session_service.dart';
import 'package:navidrome_client/services/export_service.dart';
import 'package:navidrome_client/pages/albums_page.dart';
import 'package:navidrome_client/pages/tracks_page.dart';
import 'package:navidrome_client/pages/playlists_page.dart';
import 'package:navidrome_client/pages/artists_page.dart';
import 'package:navidrome_client/pages/artist_details_page.dart';
import 'package:package_info_plus/package_info_plus.dart';

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
  final _eventLog = EventLogService();
  // final ScrollController _scrollController = ScrollController();
  int _selectedIndex = 0; // default to Home per user's "first time" request
  int _offlineSize = 0;
  bool _isRefreshingStorage = false;
  int _logErrorCount = 0;
  bool _stopPlaybackOnTaskRemoved = true;
  String _appVersion = '';

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
  ];

  // #7/#4: read synchronously from in-memory state after initialize()
  bool get _isOfflineMode => OfflineService().isOfflineMode;

  @override
  void initState() {
    super.initState();
    _initApiService().then((_) {
      _loadHomeContent();
      // restore playback session once API is ready
      if (_apiService != null) {
        PlayerService().restoreSession(_apiService!);
      }
    });

    _loadSessionState();

    // listen for log changes to update the error badge in settings
    _logErrorCount = _eventLog.errorCount;
    _eventLog.changeNotifier.addListener(_onLogChanged);

    // #20: listen for auto-toggles
    OfflineService().offlineModeNotifier.addListener(_onOfflineModeChanged);
    OfflineService().addListener(_onOfflineCompletion);

    _loadAppVersion();
  }

  Future<void> _loadAppVersion() async {
    final packageInfo = await PackageInfo.fromPlatform();
    if (mounted) {
      setState(() {
        _appVersion = '${packageInfo.version}+${packageInfo.buildNumber}';
      });
    }
  }

  void _onLogChanged() {
    final count = _eventLog.errorCount;
    if (count != _logErrorCount && mounted) {
      setState(() {
        _logErrorCount = count;
      });
    }
  }

  void _onOfflineCompletion() {
    if (!mounted) return;
    // Only rebuild the whole page if we are in offline mode (to filter the list).
    // Individual items (TrackListItem, etc.) already handle their own icons via listeners.
    if (OfflineService().isOfflineMode) {
      setState(() {});
    }
  }

  void _onOfflineModeChanged() {
    if (mounted) {
      setState(() {});
    }
  }

  Future<void> _loadSessionState() async {
    final isFirstRun = await _sessionService.isFirstRun;
    if (!isFirstRun) {
      final tabIndex = await _sessionService.lastTabIndex;
      // final libViewName = await _sessionService.lastLibraryView;

      // LibraryView? libView;
      // if (libViewName != null) {
      //   try {
      //     libView = LibraryView.values.byName(libViewName);
      //   } catch (_) {}
      // }

      if (mounted) {
        setState(() {
          _selectedIndex = tabIndex;
        });
      }

      // session-persistent settings
      _stopPlaybackOnTaskRemoved =
          await _sessionService.stopPlaybackOnTaskRemoved;
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
    _eventLog.changeNotifier.removeListener(_onLogChanged);
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

  Future<void> _handleLogout() async {
    await _authService.logout();
    if (mounted) Navigator.pushReplacementNamed(context, '/connect');
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
    // trigger rebuild — _isOfflineMode and _albumsToDisplay are getters
    // that reflect the new value immediately
    // trigger rebuild — _isOfflineMode reflecting new value immediately
    setState(() {});
  }

  Future<void> _toggleStopPlaybackOnTaskRemoved(bool value) async {
    await _sessionService.setStopPlaybackOnTaskRemoved(value);
    PlayerService().setStopPlaybackOnTaskRemoved(value);
    if (mounted) {
      setState(() {
        _stopPlaybackOnTaskRemoved = value;
      });
    }
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
        body: Column(
          children: [
            const OfflineIndicator(),
            Expanded(
              child: Stack(
                children: [
                  IndexedStack(
                    index: _selectedIndex,
                    children: List.generate(4, (index) {
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
                  if (_apiService != null)
                    Positioned(
                      left: 0,
                      right: 0,
                      bottom: 0,
                      child: MiniPlayer(
                        apiService: _apiService!,
                        onTap: () {
                          // PlayerPage is still pushed globally to overlay everything
                          Navigator.of(context, rootNavigator: true).push(
                            MaterialPageRoute(
                              builder: (context) =>
                                  PlayerPage(apiService: _apiService!),
                              fullscreenDialog: true,
                            ),
                          );
                        },
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
        bottomNavigationBar: NavigationBar(
          selectedIndex: _selectedIndex,
          onDestinationSelected: (index) {
            if (index == _selectedIndex) {
              // pop to root of current tab if re-selected
              _navigatorKeys[index].currentState?.popUntil((r) => r.isFirst);
            } else {
              setState(() {
                _selectedIndex = index;
              });
              _sessionService.setLastTabIndex(index);
            }

            if (index == 3) {
              _refreshStorageStats();
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
              icon: Icon(Icons.settings_rounded),
              label: 'settings',
            ),
          ],
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
                            artist['name']?.toString().toLowerCase() ??
                                'unknown artist',
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
                        return AlbumListItem(
                          album: album,
                          coverArtUrl: coverArtUrl,
                          onTap: () {
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (context) => AlbumDetailsPage(
                                  album: album,
                                  apiService: _apiService!,
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
          ?trailing,
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
                ],
              ),
            ),
          ],
        );
      },
    );
  }

  // Old builders removed

  Future<void> _refreshStorageStats() async {
    if (_isRefreshingStorage) return;
    setState(() {
      _isRefreshingStorage = true;
    });

    try {
      final size = await DiskUtility.getOfflineSize();
      if (mounted) {
        setState(() {
          _offlineSize = size;
        });
      }
    } finally {
      if (mounted) {
        setState(() {
          _isRefreshingStorage = false;
        });
      }
    }
  }

  Future<void> _confirmClearDownloads() async {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        icon: Icon(
          Icons.warning_amber_rounded,
          color: colorScheme.error,
          size: 48,
        ),
        title: Text(
          'clear all downloads?',
          style: theme.textTheme.headlineSmall?.copyWith(
            color: colorScheme.error,
            fontWeight: FontWeight.bold,
          ),
          textAlign: TextAlign.center,
        ),
        content: const Text(
          'this action is permanent and will remove all of your offline music and metadata. you will need to re-download everything if you want to listen offline again.',
          textAlign: TextAlign.center,
        ),
        actionsAlignment: MainAxisAlignment.center,
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('cancel'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: colorScheme.error,
              foregroundColor: colorScheme.onError,
            ),
            onPressed: () => Navigator.pop(context, true),
            child: const Text('clear all'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      if (mounted) {
        setState(() {
          _isRefreshingStorage = true;
        });
        try {
          await OfflineService().clearAllDownloads();
          final size = await DiskUtility.getOfflineSize();
          if (mounted) {
            setState(() {
              _offlineSize = size;
            });
          }
        } finally {
          if (mounted) {
            setState(() {
              _isRefreshingStorage = false;
            });
          }
        }
      }
    }
  }

  Widget _buildSettingsView() {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Column(
      children: [
        AppBar(title: const Text('settings'), primary: !_isOfflineMode),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Card(
                child: Column(
                  children: [
                    ListTile(
                      leading: const Icon(Icons.download_for_offline_rounded),
                      title: const Text('downloads'),
                      subtitle: Text(
                        '${DiskUtility.formatBytes(_offlineSize)} of media saved offline',
                      ),
                      trailing: _isRefreshingStorage
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : IconButton(
                              icon: const Icon(Icons.refresh_rounded),
                              onPressed: _refreshStorageStats,
                            ),
                    ),
                    if (_offlineSize > 0)
                      Padding(
                        padding: const EdgeInsets.all(8.0),
                        child: OutlinedButton.icon(
                          onPressed: _confirmClearDownloads,
                          style: OutlinedButton.styleFrom(
                            foregroundColor: colorScheme.error,
                            side: BorderSide(color: colorScheme.error),
                          ),
                          icon: const Icon(Icons.delete_forever_rounded),
                          label: const Text('clear all downloads'),
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 8),
              Card(
                child: SwitchListTile(
                  secondary: const Icon(Icons.offline_pin_rounded),
                  title: const Text('offline mode'),
                  subtitle: const Text('only show downloaded content'),
                  value: _isOfflineMode,
                  onChanged: _toggleOfflineMode,
                ),
              ),
              if (Platform.isAndroid)
                Card(
                  child: SwitchListTile(
                    secondary: const Icon(Icons.stop_circle_rounded),
                    title: const Text(
                      'stop playback when app is removed from background tasks',
                    ),
                    subtitle: const Text(
                      'automatically stop music when swiped away from recent apps',
                    ),
                    value: _stopPlaybackOnTaskRemoved,
                    onChanged: _toggleStopPlaybackOnTaskRemoved,
                  ),
                ),
              Card(
                child: ListTile(
                  leading: Badge(
                    isLabelVisible: _logErrorCount > 0,
                    label: Text(
                      _logErrorCount > 99 ? '99+' : _logErrorCount.toString(),
                    ),
                    backgroundColor: colorScheme.error,
                    textColor: colorScheme.onError,
                    child: const Icon(Icons.bug_report_rounded),
                  ),
                  title: const Text('event log'),
                  subtitle: const Text('debug events and errors'),
                  trailing: const Icon(Icons.chevron_right_rounded),
                  onTap: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (context) => const EventLogPage(),
                      ),
                    );
                  },
                ),
              ),
              Card(
                child: ListTile(
                  leading: const Icon(Icons.bolt_rounded),
                  title: const Text('trigger test error'),
                  subtitle: const Text('verify sentry integration'),
                  onTap: () => throw Exception('sentry test error'),
                ),
              ),
              const SizedBox(height: 8),
              Card(
                child: ListTile(
                  leading: const Icon(Icons.backup_rounded),
                  title: const Text('backup configuration'),
                  subtitle: const Text(
                    'save your server details and settings to a file',
                  ),
                  trailing: const Icon(Icons.chevron_right_rounded),
                  onTap: () async {
                    final theme = Theme.of(context);
                    final colorScheme = theme.colorScheme;

                    final confirmed = await showDialog<bool>(
                      context: context,
                      builder: (context) => AlertDialog(
                        icon: Icon(
                          Icons.warning_amber_rounded,
                          color: colorScheme.error,
                          size: 48,
                        ),
                        title: Text(
                          'security warning',
                          style: theme.textTheme.headlineSmall?.copyWith(
                            color: colorScheme.error,
                            fontWeight: FontWeight.bold,
                          ),
                          textAlign: TextAlign.center,
                        ),
                        content: const Text(
                          'the backup file will contain your server password in plain text. please ensure you save this file in a secure location and do not share it with others.',
                          textAlign: TextAlign.center,
                        ),
                        actionsAlignment: MainAxisAlignment.center,
                        actions: [
                          TextButton(
                            onPressed: () => Navigator.pop(context, false),
                            child: const Text('cancel'),
                          ),
                          FilledButton(
                            style: FilledButton.styleFrom(
                              backgroundColor: colorScheme.primary,
                              foregroundColor: colorScheme.onPrimary,
                            ),
                            onPressed: () => Navigator.pop(context, true),
                            child: const Text('i understand, backup'),
                          ),
                        ],
                      ),
                    );

                    if (confirmed == true) {
                      final success = await ExportService().exportSettings();
                      if (mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text(
                              success
                                  ? 'backup created successfully'
                                  : 'failed to create backup',
                            ),
                          ),
                        );
                      }
                    }
                  },
                ),
              ),
              const SizedBox(height: 8),
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
              if (_appVersion.isNotEmpty) ...[
                const SizedBox(height: 32),
                Center(
                  child: Text(
                    'version $_appVersion',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: colorScheme.onSurfaceVariant.withValues(
                        alpha: 0.5,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 32),
              ],
            ],
          ),
        ),
      ],
    );
  }
}
