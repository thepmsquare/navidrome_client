import 'package:flutter/material.dart';
import 'package:navidrome_client/components/artist_list_item.dart';
import 'package:navidrome_client/pages/artist_details_page.dart';
import 'package:navidrome_client/services/api_service.dart';
import 'package:navidrome_client/services/offline_service.dart';

class ArtistsPage extends StatefulWidget {
  final ApiService apiService;

  const ArtistsPage({super.key, required this.apiService});

  @override
  State<ArtistsPage> createState() => _ArtistsPageState();
}

class _ArtistsPageState extends State<ArtistsPage> {
  final ScrollController _scrollController = ScrollController();
  final TextEditingController _searchController = TextEditingController();
  
  List<Map<String, dynamic>> _artists = [];
  bool _isLoading = true;
  bool _isFetchingMore = false;
  bool _hasMore = true;
  int _offset = 0;
  final int _limit = 50;
  
  bool _isSearchActive = false;
  String _searchQuery = '';
  
  bool get _isOfflineMode => OfflineService().isOfflineMode;

  @override
  void initState() {
    super.initState();
    _loadArtists();
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
      if (_isOfflineMode && _artists.isEmpty) {
        _loadFromCache();
      }
    }
  }

  Future<void> _loadArtists({bool refresh = false}) async {
    if (refresh) {
      if (mounted) {
        setState(() {
          _offset = 0;
          _artists = [];
          _hasMore = true;
          _isLoading = true;
        });
      }
    }

    try {
      final List<Map<String, dynamic>> newArtists;
      if (_searchQuery.isEmpty) {
        // getArtists returns the whole list, so no pagination here for the full list
        // unless we use search3 with '*' query which might be slower or different.
        // For parity with Albums, we'll try to use searchArtists with '*' for the initial load if we want pagination.
        // But getArtists is more reliable for "all artists".
        if (_offset == 0) {
          newArtists = await widget.apiService.getArtists();
          _hasMore = false; // getArtists returns all
        } else {
          newArtists = [];
          _hasMore = false;
        }
      } else {
        newArtists = await widget.apiService.searchArtists(
          _searchQuery,
          count: _limit,
          offset: _offset,
        );
        if (newArtists.length < _limit) _hasMore = false;
      }

      if ((_offset == 0 || refresh) && _searchQuery.isEmpty) {
        await OfflineService().saveArtistListCache(newArtists);
      }

      if (mounted) {
        setState(() {
          _artists.addAll(newArtists);
          _isLoading = false;
          _isFetchingMore = false;
          _offset += newArtists.length;
        });
      }
    } catch (e) {
      if (_artists.isEmpty) await _loadFromCache();
      if (mounted) {
        setState(() {
          _isLoading = false;
          _isFetchingMore = false;
        });
      }
    }
  }

  Future<void> _loadFromCache() async {
    final cached = await OfflineService().getCachedArtistList();
    if (cached != null && mounted) {
      setState(() {
        _artists = cached;
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
          _loadArtists();
        }
      }
    }
  }

  void _onSearchChanged(String query) {
    setState(() {
      _searchQuery = query;
    });
    _loadArtists(refresh: true);
  }

  @override
  Widget build(BuildContext context) {
    // filter artists if offline mode is active? 
    // actually, we don't have a concept of "offline artist" yet, 
    // but we can filter artists who have at least one offline album.
    // However, the user just wants feature parity, and AlbumsPage filters by offline sync.
    // For now, we'll show all cached artists in offline mode.
    final artists = _artists;

    return Scaffold(
      body: RefreshIndicator(
        onRefresh: () => _loadArtists(refresh: true),
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
                        hintText: 'search artists...',
                        border: InputBorder.none,
                        hintStyle: TextStyle(color: Colors.grey),
                        contentPadding: EdgeInsets.zero,
                        fillColor: Colors.transparent,
                      ),
                      onChanged: _onSearchChanged,
                    )
                  : const Text('artists'),
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
                    _loadArtists(refresh: true);
                  } else {
                    Navigator.pop(context);
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
            if (_isLoading && _artists.isEmpty)
              const SliverFillRemaining(
                child: Center(child: CircularProgressIndicator()),
              )
            else if (artists.isEmpty)
              SliverFillRemaining(
                child: Center(
                  child: Text(
                    _isOfflineMode ? 'no cached artists' : 'no artists found',
                  ),
                ),
              )
            else
              SliverPadding(
                padding: const EdgeInsets.only(top: 8, bottom: 100),
                sliver: SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (context, index) {
                      if (index == artists.length) {
                        return (_hasMore && !_isOfflineMode)
                            ? const Padding(
                                padding: EdgeInsets.all(32.0),
                                child: Center(child: CircularProgressIndicator()),
                              )
                            : const SizedBox.shrink();
                      }

                      final artist = artists[index];
                      final coverArtId = artist['coverArt'];
                      final String? coverArtUrl =
                          coverArtId != null
                          ? widget.apiService.getCoverArtUrl(coverArtId)
                          : null;

                      return ArtistListItem(
                        artist: artist,
                        coverArtUrl: coverArtUrl,
                        onTap: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (context) => ArtistDetailsPage(
                                artist: artist,
                                apiService: widget.apiService,
                              ),
                            ),
                          );
                        },
                      );
                    },
                    childCount:
                        artists.length + ((_hasMore && !_isOfflineMode) ? 1 : 0),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
