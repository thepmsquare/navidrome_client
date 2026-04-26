import 'package:flutter/material.dart';
import 'package:navidrome_client/components/track_list_item.dart';
import 'package:navidrome_client/services/api_service.dart';
import 'package:navidrome_client/services/offline_service.dart';
import 'package:navidrome_client/services/player_service.dart';
import 'package:navidrome_client/pages/home_page.dart' show TrackSortOrder;
import 'package:navidrome_client/pages/artist_details_page.dart';

class TracksPage extends StatefulWidget {
  final ApiService apiService;

  const TracksPage({super.key, required this.apiService});

  @override
  State<TracksPage> createState() => _TracksPageState();
}

class _TracksPageState extends State<TracksPage> {
  final ScrollController _scrollController = ScrollController();
  final TextEditingController _searchController = TextEditingController();
  
  List<Map<String, dynamic>> _tracks = [];
  bool _isLoading = true;
  bool _isFetchingMore = false;
  bool _hasMore = true;
  int _offset = 0;
  final int _limit = 50;
  
  bool _isSearchActive = false;
  String _searchQuery = '';
  TrackSortOrder _trackSortOrder = TrackSortOrder.name;

  bool get _isOfflineMode => OfflineService().isOfflineMode;

  List<Map<String, dynamic>> get _tracksToDisplay {
    List<Map<String, dynamic>> result = _tracks;
    if (_isOfflineMode) {
      result = result
          .where((t) => OfflineService().isTrackOfflineSync(t['id'].toString()))
          .toList();
    }
    
    // sorting is handled by API usually, but local fallback for search/cache might need it
    // however, we'll follow the pattern from home_page
    return result;
  }

  @override
  void initState() {
    super.initState();
    _loadTracks();
    _scrollController.addListener(_onScroll);
    OfflineService().offlineModeNotifier.addListener(_onOfflineModeChanged);
  }

  @override
  void dispose() {
    _scrollController.dispose();
    _searchController.dispose();
    OfflineService().offlineModeNotifier.removeListener(_onOfflineModeChanged);
    super.dispose();
  }

  void _onOfflineModeChanged() {
    if (mounted) {
      setState(() {});
      if (_isOfflineMode && _tracks.isEmpty) {
        _loadFromCache();
      }
    }
  }

  Future<void> _loadTracks({bool refresh = false}) async {
    if (refresh) {
      if (mounted) {
        setState(() {
          _offset = 0;
          _tracks = [];
          _hasMore = true;
          _isLoading = true;
        });
      }
    }

    try {
      List<Map<String, dynamic>> newTracks;
      if (_searchQuery.isEmpty) {
        String? orderBy;
        String orderDirection = 'asc';

        switch (_trackSortOrder) {
          case TrackSortOrder.name: orderBy = 'title'; break;
          case TrackSortOrder.artist: orderBy = 'artist'; break;
          case TrackSortOrder.album: orderBy = 'album'; break;
          case TrackSortOrder.rating: orderBy = 'rating'; orderDirection = 'desc'; break;
          case TrackSortOrder.year: orderBy = 'year'; orderDirection = 'desc'; break;
          case TrackSortOrder.duration: orderBy = 'duration'; orderDirection = 'desc'; break;
          case TrackSortOrder.genre: orderBy = 'genre'; break;
          case TrackSortOrder.playCount: orderBy = 'playCount'; orderDirection = 'desc'; break;
          case TrackSortOrder.dateAdded: orderBy = 'created'; orderDirection = 'desc'; break;
          case TrackSortOrder.lastPlayed: orderBy = 'lastPlayed'; orderDirection = 'desc'; break;
          case TrackSortOrder.bitRate: orderBy = 'bitRate'; orderDirection = 'desc'; break;
        }

        try {
          newTracks = await widget.apiService.getSongList(
            count: _limit,
            offset: _offset,
            orderBy: orderBy,
            orderDirection: orderDirection,
          );
        } catch (e) {
          newTracks = await widget.apiService.searchSongs('*', count: _limit, offset: _offset);
        }
      } else {
        newTracks = await widget.apiService.searchSongs(_searchQuery, count: _limit, offset: _offset);
      }

      if (_offset == 0 || refresh) {
        await OfflineService().saveTrackListCache(newTracks);
      }

      if (mounted) {
        setState(() {
          _tracks.addAll(newTracks);
          _isLoading = false;
          _isFetchingMore = false;
          _offset += newTracks.length;
          if (newTracks.length < _limit) _hasMore = false;
        });
      }
    } catch (e) {
      if (_tracks.isEmpty) await _loadFromCache();
      if (mounted) {
        setState(() {
          _isLoading = false;
          _isFetchingMore = false;
        });
      }
    }
  }

  Future<void> _loadFromCache() async {
    final cached = await OfflineService().getCachedTrackList();
    if (cached != null && mounted) {
      setState(() {
        _tracks = cached;
        _isLoading = false;
        _hasMore = false;
      });
    } else if (mounted) {
      setState(() {
        _isLoading = false;
      });
    }
  }

  void _onScroll() {
    if (!_scrollController.hasClients) return;
    if (_scrollController.position.pixels >=
        _scrollController.position.maxScrollExtent - 200) {
      if (!_isFetchingMore && !_isOfflineMode && _hasMore) {
        if (mounted) {
          setState(() {
            _isFetchingMore = true;
          });
          _loadTracks();
        }
      }
    }
  }

  void _onSearchChanged(String query) {
    setState(() {
      _searchQuery = query;
    });
    _loadTracks(refresh: true);
  }

  @override
  Widget build(BuildContext context) {
    final tracks = _tracksToDisplay;

    return Scaffold(
      body: RefreshIndicator(
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
                        contentPadding: EdgeInsets.zero,
                        fillColor: Colors.transparent,
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
                    Navigator.pop(context);
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
                    itemBuilder: (BuildContext context) => <PopupMenuEntry<TrackSortOrder>>[
                      for (var val in TrackSortOrder.values)
                        PopupMenuItem<TrackSortOrder>(
                          value: val,
                          child: Text(val.name.replaceAll(RegExp(r'(?=[A-Z])'), ' ').toLowerCase()),
                        ),
                    ],
                  ),
                ],
              ],
            ),
            if (_isLoading && _tracks.isEmpty)
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
                        return (_hasMore && !_isOfflineMode)
                            ? const Padding(
                                padding: EdgeInsets.all(32.0),
                                child: Center(child: CircularProgressIndicator()),
                              )
                            : const SizedBox.shrink();
                      }

                      final track = tracks[index];
                      final String? coverArtId = track['coverArt']?.toString();
                      final String? coverArtUrl =
                          coverArtId != null
                          ? widget.apiService.getCoverArtUrl(coverArtId)
                          : null;

                      return TrackListItem(
                        track: track,
                        coverArtUrl: coverArtUrl,
                        apiService: widget.apiService,
                        onTap: () {
                          PlayerService().play(tracks, index, widget.apiService);
                        },
                        onArtistTap: (artist) {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (context) => ArtistDetailsPage(
                                artist: {
                                  ...artist,
                                  'coverArt': artist['coverArt'] ?? track['artistCoverArt'] ?? track['coverArt'],
                                },
                                apiService: widget.apiService,
                              ),
                            ),
                          );
                        },
                      );
                    },
                    childCount:
                        tracks.length + ((_hasMore && !_isOfflineMode) ? 1 : 0),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
