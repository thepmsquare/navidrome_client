import 'dart:async';
import 'dart:io' show Platform;
import 'package:flutter/material.dart';
import 'package:navidrome_client/components/album_list_item.dart';
import 'package:navidrome_client/components/album_tile.dart';
import 'package:navidrome_client/components/playlist_list_item.dart';
import 'package:navidrome_client/components/track_list_item.dart';
import 'package:navidrome_client/components/mini_player.dart';
import 'package:navidrome_client/utils/disk_utility.dart';
import 'package:navidrome_client/pages/player_page.dart';
import 'package:navidrome_client/pages/album_details_page.dart';
import 'package:navidrome_client/pages/event_log_page.dart';
import 'package:navidrome_client/pages/playlist_details_page.dart';
import 'package:navidrome_client/services/api_service.dart';
import 'package:navidrome_client/services/event_log_service.dart';
import 'package:navidrome_client/services/player_service.dart';
import 'package:navidrome_client/services/auth_service.dart';
import 'package:navidrome_client/services/offline_service.dart';
import 'package:navidrome_client/components/offline_indicator.dart';
import 'package:navidrome_client/services/session_service.dart';
import 'package:navidrome_client/services/export_service.dart';
import 'package:package_info_plus/package_info_plus.dart';

enum LibraryView { home, albums, playlists, tracks }

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
  final ScrollController _scrollController = ScrollController();
  int _selectedIndex = 0; // default to Home per user's "first time" request
  int _offlineSize = 0;
  bool _isRefreshingStorage = false;
  int _logErrorCount = 0;
  bool _stopPlaybackOnTaskRemoved = true;
  String _appVersion = '';

  List<Map<String, dynamic>> _albums = [];
  List<Map<String, dynamic>> _playlists = [];
  List<Map<String, dynamic>> _tracks = [];
  List<Map<String, dynamic>> _mostPlayedAlbums = [];
  List<Map<String, dynamic>> _randomTracks = [];
  bool _isLoading = true;
  bool _isLoadingPlaylists = false;
  bool _isLoadingTracks = false;
  bool _isLoadingHome = false;
  bool _isFetchingMore = false;
  bool _hasMore = true;
  bool _hasMoreTracks = true;
  int _offset = 0;
  int _tracksOffset = 0;
  final int _limit = 50;
  LibraryView _currentLibraryView = LibraryView.home;
  ApiService? _apiService;

  final TextEditingController _searchController = TextEditingController();
  final TextEditingController _universalSearchController =
      TextEditingController();
  final FocusNode _universalSearchFocusNode = FocusNode();
  bool _isSearchActive = false;
  String _searchQuery = '';
  Timer? _debounce;
  TrackSortOrder _trackSortOrder = TrackSortOrder.name;

  List<Map<String, dynamic>> _universalSearchArtists = [];
  List<Map<String, dynamic>> _universalSearchAlbums = [];
  List<Map<String, dynamic>> _universalSearchTracks = [];
  bool _isUniversalSearching = false;

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
          .where(
            (p) => OfflineService().isPlaylistOfflineSync(p['id'].toString()),
          )
          .toList();
    }
    if (_searchQuery.isNotEmpty) {
      final query = _searchQuery.toLowerCase();
      result = result
          .where(
            (p) => (p['name'] ?? '').toString().toLowerCase().contains(query),
          )
          .toList();
    }
    return result;
  }

  List<Map<String, dynamic>> get _tracksToDisplay {
    List<Map<String, dynamic>> result = _tracks;
    if (_isOfflineMode) {
      result = result
          .where((t) => OfflineService().isTrackOfflineSync(t['id'].toString()))
          .toList();
    }
    if (_searchQuery.isNotEmpty) {
      final query = _searchQuery.toLowerCase();
      result = result
          .where(
            (t) =>
                (t['title'] ?? '').toString().toLowerCase().contains(query) ||
                (t['artist'] ?? '').toString().toLowerCase().contains(query),
          )
          .toList();
    }

    // sort based on _trackSortOrder
    final List<Map<String, dynamic>> sortedList = List.from(result);
    sortedList.sort((a, b) {
      int cmp = 0;
      switch (_trackSortOrder) {
        case TrackSortOrder.name:
          final aTitle = (a['title'] ?? '').toString().toLowerCase();
          final bTitle = (b['title'] ?? '').toString().toLowerCase();
          cmp = aTitle.compareTo(bTitle);
          break;
        case TrackSortOrder.artist:
          final aArtist = (a['artist'] ?? '').toString().toLowerCase();
          final bArtist = (b['artist'] ?? '').toString().toLowerCase();
          cmp = aArtist.compareTo(bArtist);
          break;
        case TrackSortOrder.album:
          final aAlbum = (a['album'] ?? '').toString().toLowerCase();
          final bAlbum = (b['album'] ?? '').toString().toLowerCase();
          cmp = aAlbum.compareTo(bAlbum);
          break;
        case TrackSortOrder.rating:
          final aRating = (a['userRating'] ?? 0) as int;
          final bRating = (b['userRating'] ?? 0) as int;
          cmp = bRating.compareTo(aRating); // descending
          break;
        case TrackSortOrder.year:
          final aYear = (a['year'] ?? 0) as int;
          final bYear = (b['year'] ?? 0) as int;
          cmp = bYear.compareTo(aYear); // descending
          break;
        case TrackSortOrder.duration:
          final aDuration = (a['duration'] ?? 0) as int;
          final bDuration = (b['duration'] ?? 0) as int;
          cmp = bDuration.compareTo(aDuration); // descending
          break;
        case TrackSortOrder.genre:
          final aGenre = (a['genre'] ?? '').toString().toLowerCase();
          final bGenre = (b['genre'] ?? '').toString().toLowerCase();
          cmp = aGenre.compareTo(bGenre);
          break;
        case TrackSortOrder.playCount:
          final aPlayCount = (a['playCount'] ?? 0) as int;
          final bPlayCount = (b['playCount'] ?? 0) as int;
          cmp = bPlayCount.compareTo(aPlayCount); // descending
          break;
        case TrackSortOrder.dateAdded:
          final aCreated = (a['created'] ?? '').toString();
          final bCreated = (b['created'] ?? '').toString();
          cmp = bCreated.compareTo(aCreated); // descending
          break;
        case TrackSortOrder.lastPlayed:
          final aLast = (a['lastPlayed'] ?? '').toString();
          final bLast = (b['lastPlayed'] ?? '').toString();
          cmp = bLast.compareTo(aLast); // descending
          break;
        case TrackSortOrder.bitRate:
          final aBit = (a['bitRate'] ?? 0) as int;
          final bBit = (b['bitRate'] ?? 0) as int;
          cmp = bBit.compareTo(aBit); // descending
          break;
      }

      // secondary sort by name
      if (cmp == 0 && _trackSortOrder != TrackSortOrder.name) {
        final aTitle = (a['title'] ?? '').toString().toLowerCase();
        final bTitle = (b['title'] ?? '').toString().toLowerCase();
        return aTitle.compareTo(bTitle);
      }
      return cmp;
    });

    return sortedList;
  }

  @override
  void initState() {
    super.initState();
    _initApiService().then((_) {
      _loadHomeContent();
      _loadAlbums();
      _loadPlaylists();
      _loadTracks();
      // restore playback session once API is ready
      if (_apiService != null) {
        PlayerService().restoreSession(_apiService!);
      }
    });

    _loadSessionState();
    _scrollController.addListener(_onScroll);

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
      // if it just went offline, make sure we show cached data
      if (OfflineService().isOfflineMode) {
        if (_albums.isEmpty) _loadFromCache();
        if (_playlists.isEmpty) _loadPlaylistsFromCache();
        if (_tracks.isEmpty) _loadTracksFromCache();
      }
    }
  }

  Future<void> _loadSessionState() async {
    final isFirstRun = await _sessionService.isFirstRun;
    if (!isFirstRun) {
      final tabIndex = await _sessionService.lastTabIndex;
      final libViewName = await _sessionService.lastLibraryView;

      LibraryView? libView;
      if (libViewName != null) {
        try {
          libView = LibraryView.values.byName(libViewName);
        } catch (_) {}
      }

      if (mounted) {
        setState(() {
          _selectedIndex = tabIndex;
          if (libView != null) _currentLibraryView = libView;
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
    _scrollController.dispose();
    _searchController.dispose();
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
          : await _apiService!.searchAlbums(
              _searchQuery,
              count: _limit,
              offset: _offset,
            );

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
      setState(() {
        _isLoading = false;
      });
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
      setState(() {
        _isLoadingPlaylists = false;
      });
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
        setState(() {
          _isLoadingPlaylists = false;
        });
      }
    }
  }

  Future<void> _loadTracksFromCache() async {
    final cached = await OfflineService().getCachedTrackList();
    if (cached != null && mounted) {
      setState(() {
        _tracks = cached;
        _isLoadingTracks = false;
        _hasMoreTracks = false;
      });
    } else if (mounted) {
      setState(() {
        _isLoadingTracks = false;
      });
    }
  }

  Future<void> _loadTracks({bool refresh = false}) async {
    if (refresh) {
      if (mounted) {
        setState(() {
          _tracksOffset = 0;
          _tracks = [];
          _hasMoreTracks = true;
          _isLoadingTracks = true;
        });
      }
    }

    if (_isOfflineMode && _apiService == null) {
      await _loadTracksFromCache();
      return;
    }

    if (_apiService == null) return;

    try {
      List<Map<String, dynamic>> newTracks;

      if (_searchQuery.isEmpty) {
        String? orderBy;
        String orderDirection = 'asc';

        switch (_trackSortOrder) {
          case TrackSortOrder.name:
            orderBy = 'title';
            break;
          case TrackSortOrder.artist:
            orderBy = 'artist';
            break;
          case TrackSortOrder.album:
            orderBy = 'album';
            break;
          case TrackSortOrder.rating:
            orderBy = 'rating';
            orderDirection = 'desc';
            break;
          case TrackSortOrder.year:
            orderBy = 'year';
            orderDirection = 'desc';
            break;
          case TrackSortOrder.duration:
            orderBy = 'duration';
            orderDirection = 'desc';
            break;
          case TrackSortOrder.genre:
            orderBy = 'genre';
            break;
          case TrackSortOrder.playCount:
            orderBy = 'playCount';
            orderDirection = 'desc';
            break;
          case TrackSortOrder.dateAdded:
            orderBy = 'created';
            orderDirection = 'desc';
            break;
          case TrackSortOrder.lastPlayed:
            orderBy = 'lastPlayed';
            orderDirection = 'desc';
            break;
          case TrackSortOrder.bitRate:
            orderBy = 'bitRate';
            orderDirection = 'desc';
            break;
        }

        try {
          newTracks = await _apiService!.getSongList(
            count: _limit,
            offset: _tracksOffset,
            orderBy: orderBy,
            orderDirection: orderDirection,
          );
        } catch (e) {
          debugPrint('getsonglist failed, falling back to search3: $e');
          newTracks = await _apiService!.searchSongs(
            '*',
            count: _limit,
            offset: _tracksOffset,
          );
        }
      } else {
        newTracks = await _apiService!.searchSongs(
          _searchQuery,
          count: _limit,
          offset: _tracksOffset,
        );
      }

      // cache page 1
      if (_tracksOffset == 0 || refresh) {
        await OfflineService().saveTrackListCache(newTracks);
      }

      if (mounted) {
        setState(() {
          _tracks.addAll(newTracks);
          _isLoadingTracks = false;
          _isFetchingMore = false;
          _tracksOffset += newTracks.length;
          if (newTracks.length < _limit) _hasMoreTracks = false;
        });
      }
    } catch (e) {
      if (_tracks.isEmpty) await _loadTracksFromCache();
      if (mounted) {
        setState(() {
          _isLoadingTracks = false;
          _isFetchingMore = false;
        });
      }
    }
  }

  void _onScroll() {
    if (!_scrollController.hasClients) return;
    if (_scrollController.position.pixels >=
        _scrollController.position.maxScrollExtent - 200) {
      if (!_isFetchingMore && !_isOfflineMode) {
        if (_currentLibraryView == LibraryView.albums && _hasMore) {
          if (mounted) {
            setState(() {
              _isFetchingMore = true;
            });
            _loadAlbums();
          }
        } else if (_currentLibraryView == LibraryView.tracks &&
            _hasMoreTracks) {
          if (mounted) {
            setState(() {
              _isFetchingMore = true;
            });
            _loadTracks();
          }
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
        } else if (_currentLibraryView == LibraryView.tracks) {
          _loadTracks(refresh: true);
        }
        // playlists search is local via getter
      }
    });
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
    setState(() {});
    // if switching to offline with no content loaded from cache yet, load them
    if (value) {
      if (_albums.isEmpty) await _loadFromCache();
      if (_playlists.isEmpty) await _loadPlaylistsFromCache();
      if (_tracks.isEmpty) await _loadTracksFromCache();
    }
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
    return Scaffold(
      body: Column(
        children: [
          const OfflineIndicator(),
          Expanded(
            child: Stack(
              children: [
                IndexedStack(
                  index: _selectedIndex,
                  children: [
                    _buildHomeView(),
                    _buildLibraryView(),
                    _buildSearchView(),
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
          if (index == 1 && _selectedIndex == 1) {
            setState(() {
              _currentLibraryView = LibraryView.home;
              _sessionService.setLastLibraryView('home');
            });
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
          NavigationDestination(icon: Icon(Icons.home_rounded), label: 'home'),
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
    );
  }

  Widget _buildHomeView() {
    if (_isLoadingHome && _mostPlayedAlbums.isEmpty && _randomTracks.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_isOfflineMode) {
      return const Center(child: Text('home content not available offline'));
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
                      final String? coverArtId = track['coverArt']?.toString();
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
  }

  Widget _buildSearchView() {
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
                        // artists are not yet fully implemented in this client
                        // but we show them in search results
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
    switch (_currentLibraryView) {
      case LibraryView.home:
        return _buildLibraryMenu();
      case LibraryView.albums:
        return _buildAlbumList();
      case LibraryView.playlists:
        return _buildPlaylistList();
      case LibraryView.tracks:
        return _buildTrackList();
    }
  }

  Widget _buildLibraryMenu() {
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
                  setState(() {
                    _currentLibraryView = LibraryView.playlists;
                  });
                  _sessionService.setLastLibraryView('playlists');
                  _loadPlaylists();
                },
              ),
              ListTile(
                leading: const Icon(Icons.audiotrack_rounded),
                title: const Text('tracks'),
                onTap: () {
                  setState(() {
                    _currentLibraryView = LibraryView.tracks;
                  });
                  _sessionService.setLastLibraryView('tracks');
                  _loadTracks();
                },
              ),
              ListTile(
                leading: const Icon(Icons.album_rounded),
                title: const Text('albums'),
                onTap: () {
                  setState(() {
                    _currentLibraryView = LibraryView.albums;
                  });
                  _sessionService.setLastLibraryView('albums');
                },
              ),
            ],
          ),
        ),
      ],
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
            primary: !_isOfflineMode,
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
              icon: Icon(
                _isSearchActive
                    ? Icons.close_rounded
                    : Icons.arrow_back_rounded,
              ),
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
                    final String? coverArtUrl =
                        _apiService != null && coverArtId != null
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
                            builder: (context) =>
                                AlbumDetailsPage(album: album, apiService: api),
                          ),
                        );
                      },
                    );
                  },
                  childCount:
                      albums.length + ((_hasMore && !_isOfflineMode) ? 1 : 0),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildTrackList() {
    final tracks = _tracksToDisplay;

    return RefreshIndicator(
      onRefresh: () => _loadTracks(refresh: true),
      child: CustomScrollView(
        controller: _scrollController,
        slivers: [
          SliverAppBar.large(
            primary: !_isOfflineMode,
            title: _isSearchActive
                ? TextField(
                    controller: _searchController,
                    autofocus: true,
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.onSurface,
                      fontSize: 18,
                    ),
                    decoration: const InputDecoration(
                      hintText: 'search tracks...',
                      border: InputBorder.none,
                      hintStyle: TextStyle(color: Colors.grey),
                    ),
                    onChanged: _onSearchChanged,
                  )
                : const Text('tracks'),
            leading: IconButton(
              icon: Icon(
                _isSearchActive
                    ? Icons.close_rounded
                    : Icons.arrow_back_rounded,
              ),
              onPressed: () {
                if (_isSearchActive) {
                  setState(() {
                    _isSearchActive = false;
                    _searchQuery = '';
                    _searchController.clear();
                  });
                  _loadTracks(refresh: true);
                } else {
                  setState(() {
                    _currentLibraryView = LibraryView.home;
                  });
                }
              },
            ),
            actions: [
              if (!_isSearchActive && !_isOfflineMode) ...[
                IconButton(
                  icon: const Icon(Icons.search_rounded),
                  onPressed: () {
                    setState(() {
                      _isSearchActive = true;
                    });
                  },
                ),
                PopupMenuButton<TrackSortOrder>(
                  icon: const Icon(Icons.sort_rounded),
                  onSelected: (TrackSortOrder order) {
                    setState(() {
                      _trackSortOrder = order;
                    });
                    _loadTracks(refresh: true);
                  },
                  itemBuilder: (BuildContext context) =>
                      <PopupMenuEntry<TrackSortOrder>>[
                        const PopupMenuItem<TrackSortOrder>(
                          value: TrackSortOrder.name,
                          child: Text('name'),
                        ),
                        const PopupMenuItem<TrackSortOrder>(
                          value: TrackSortOrder.artist,
                          child: Text('artist'),
                        ),
                        const PopupMenuItem<TrackSortOrder>(
                          value: TrackSortOrder.album,
                          child: Text('album'),
                        ),
                        const PopupMenuItem<TrackSortOrder>(
                          value: TrackSortOrder.rating,
                          child: Text('rating'),
                        ),
                        const PopupMenuItem<TrackSortOrder>(
                          value: TrackSortOrder.year,
                          child: Text('year'),
                        ),
                        const PopupMenuItem<TrackSortOrder>(
                          value: TrackSortOrder.duration,
                          child: Text('duration'),
                        ),
                        const PopupMenuItem<TrackSortOrder>(
                          value: TrackSortOrder.genre,
                          child: Text('genre'),
                        ),
                        const PopupMenuItem<TrackSortOrder>(
                          value: TrackSortOrder.playCount,
                          child: Text('play count'),
                        ),
                        const PopupMenuItem<TrackSortOrder>(
                          value: TrackSortOrder.dateAdded,
                          child: Text('date added'),
                        ),
                        const PopupMenuItem<TrackSortOrder>(
                          value: TrackSortOrder.lastPlayed,
                          child: Text('last played'),
                        ),
                        const PopupMenuItem<TrackSortOrder>(
                          value: TrackSortOrder.bitRate,
                          child: Text('bit rate'),
                        ),
                      ],
                ),
              ],
            ],
          ),
          if (_isLoadingTracks && _tracks.isEmpty)
            const SliverFillRemaining(
              child: Center(child: CircularProgressIndicator()),
            )
          else if (tracks.isEmpty)
            SliverFillRemaining(
              child: Center(
                child: Text(
                  _isOfflineMode ? 'no downloaded tracks' : 'no tracks found',
                ),
              ),
            )
          else
            SliverPadding(
              padding: const EdgeInsets.only(top: 8, bottom: 100),
              sliver: SliverList(
                delegate: SliverChildBuilderDelegate(
                  (context, index) {
                    if (index == tracks.length) {
                      return (_hasMoreTracks && !_isOfflineMode)
                          ? const Padding(
                              padding: EdgeInsets.all(32.0),
                              child: Center(child: CircularProgressIndicator()),
                            )
                          : const SizedBox.shrink();
                    }

                    final track = tracks[index];
                    final String? coverArtId = track['coverArt']?.toString();
                    final String? coverArtUrl =
                        _apiService != null && coverArtId != null
                        ? _apiService!.getCoverArtUrl(coverArtId)
                        : null;

                    return TrackListItem(
                      track: track,
                      coverArtUrl: coverArtUrl,
                      apiService: _apiService,
                      onTap: () {
                        // playback context is the current visible list
                        PlayerService().play(tracks, index, _apiService!);
                      },
                    );
                  },
                  childCount:
                      tracks.length +
                      ((_hasMoreTracks && !_isOfflineMode) ? 1 : 0),
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
            primary: !_isOfflineMode,
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
              icon: Icon(
                _isSearchActive
                    ? Icons.close_rounded
                    : Icons.arrow_back_rounded,
              ),
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
                  _isOfflineMode
                      ? 'no downloaded playlists'
                      : 'no playlists found',
                ),
              ),
            )
          else
            SliverPadding(
              padding: const EdgeInsets.only(top: 8, bottom: 100),
              sliver: SliverList(
                delegate: SliverChildBuilderDelegate((context, index) {
                  final playlist = playlists[index];
                  final coverArtId = playlist['coverArt'];
                  final String? coverArtUrl =
                      _apiService != null && coverArtId != null
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
                }, childCount: playlists.length),
              ),
            ),
        ],
      ),
    );
  }

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
                      color: colorScheme.onSurfaceVariant.withOpacity(0.5),
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
