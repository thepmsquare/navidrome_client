import 'package:flutter/material.dart';
import 'package:navidrome_client/components/playlist_list_item.dart';
import 'package:navidrome_client/pages/playlist_details_page.dart';
import 'package:navidrome_client/services/api_service.dart';
import 'package:navidrome_client/services/offline_service.dart';

class PlaylistsPage extends StatefulWidget {
  final ApiService apiService;

  const PlaylistsPage({super.key, required this.apiService});

  @override
  State<PlaylistsPage> createState() => _PlaylistsPageState();
}

class _PlaylistsPageState extends State<PlaylistsPage> {
  final TextEditingController _searchController = TextEditingController();
  
  List<Map<String, dynamic>> _playlists = [];
  bool _isLoading = true;
  bool _isSearchActive = false;
  String _searchQuery = '';
  
  bool get _isOfflineMode => OfflineService().isOfflineMode;

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
    _loadPlaylists();
    OfflineService().offlineModeNotifier.addListener(_onOfflineModeChanged);
  }

  @override
  void dispose() {
    _searchController.dispose();
    OfflineService().offlineModeNotifier.removeListener(_onOfflineModeChanged);
    super.dispose();
  }

  void _onOfflineModeChanged() {
    if (mounted) {
      setState(() {});
      if (_isOfflineMode && _playlists.isEmpty) {
        _loadFromCache();
      }
    }
  }

  Future<void> _loadPlaylists({bool refresh = false}) async {
    if (refresh) {
      if (mounted) {
        setState(() {
          _playlists = [];
          _isLoading = true;
        });
      }
    }

    try {
      final playlists = await widget.apiService.getPlaylists();
      await OfflineService().savePlaylistListCache(playlists);

      if (mounted) {
        setState(() {
          _playlists = playlists;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (_playlists.isEmpty) await _loadFromCache();
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _loadFromCache() async {
    final cached = await OfflineService().getCachedPlaylistList();
    if (cached != null && mounted) {
      setState(() {
        _playlists = cached;
        _isLoading = false;
      });
    } else if (mounted) {
      setState(() {
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final playlists = _playlistsToDisplay;

    return Scaffold(
      body: RefreshIndicator(
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
                        contentPadding: EdgeInsets.zero,
                        fillColor: Colors.transparent,
                      ),
                      onChanged: (val) => setState(() => _searchQuery = val),
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
                    Navigator.pop(context);
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
            if (_isLoading && _playlists.isEmpty)
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
                        coverArtId != null
                        ? widget.apiService.getCoverArtUrl(coverArtId)
                        : null;

                    return PlaylistListItem(
                      playlist: playlist,
                      coverArtUrl: coverArtUrl,
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (context) => PlaylistDetailsPage(
                              playlist: playlist,
                              apiService: widget.apiService,
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
      ),
    );
  }
}
