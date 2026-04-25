import 'package:flutter/material.dart';
import 'package:navidrome_client/components/album_list_item.dart';
import 'package:navidrome_client/pages/album_details_page.dart';
import 'package:navidrome_client/pages/artist_details_page.dart';
import 'package:navidrome_client/services/api_service.dart';
import 'package:navidrome_client/services/offline_service.dart';

class AlbumsPage extends StatefulWidget {
  final ApiService apiService;

  const AlbumsPage({super.key, required this.apiService});

  @override
  State<AlbumsPage> createState() => _AlbumsPageState();
}

class _AlbumsPageState extends State<AlbumsPage> {
  final ScrollController _scrollController = ScrollController();
  final TextEditingController _searchController = TextEditingController();
  
  List<Map<String, dynamic>> _albums = [];
  bool _isLoading = true;
  bool _isFetchingMore = false;
  bool _hasMore = true;
  int _offset = 0;
  final int _limit = 50;
  
  bool _isSearchActive = false;
  String _searchQuery = '';
  
  bool get _isOfflineMode => OfflineService().isOfflineMode;

  List<Map<String, dynamic>> get _albumsToDisplay {
    if (!_isOfflineMode) return _albums;
    return _albums
        .where((a) => OfflineService().isAlbumOfflineSync(a['id'].toString()))
        .toList();
  }

  @override
  void initState() {
    super.initState();
    _loadAlbums();
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
      if (_isOfflineMode && _albums.isEmpty) {
        _loadFromCache();
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

    try {
      final newAlbums = _searchQuery.isEmpty
          ? await widget.apiService.getAlbums(count: _limit, offset: _offset)
          : await widget.apiService.searchAlbums(
              _searchQuery,
              count: _limit,
              offset: _offset,
            );

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
      if (_albums.isEmpty) await _loadFromCache();
      if (mounted) {
        setState(() {
          _isLoading = false;
          _isFetchingMore = false;
        });
      }
    }
  }

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

  void _onScroll() {
    if (!_scrollController.hasClients) return;
    if (_scrollController.position.pixels >=
        _scrollController.position.maxScrollExtent - 200) {
      if (!_isFetchingMore && !_isOfflineMode && _hasMore) {
        if (mounted) {
          setState(() {
            _isFetchingMore = true;
          });
          _loadAlbums();
        }
      }
    }
  }

  void _onSearchChanged(String query) {
    setState(() {
      _searchQuery = query;
    });
    _loadAlbums(refresh: true);
  }

  @override
  Widget build(BuildContext context) {
    final albums = _albumsToDisplay;

    return Scaffold(
      body: RefreshIndicator(
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
                        contentPadding: EdgeInsets.zero,
                        fillColor: Colors.transparent,
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
                          coverArtId != null
                          ? widget.apiService.getCoverArtUrl(coverArtId)
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
                                apiService: widget.apiService,
                              ),
                            ),
                          );
                        },
                        onArtistTap: () {
                          final artistId = album['artistId']?.toString();
                          if (artistId != null) {
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (context) => ArtistDetailsPage(
                                  artist: {
                                    'id': artistId,
                                    'name': album['artist'],
                                    'coverArt': album['coverArt'],
                                  },
                                  apiService: widget.apiService,
                                ),
                              ),
                            );
                          }
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
      ),
    );
  }
}
