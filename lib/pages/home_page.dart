import 'package:flutter/material.dart';
import 'package:navidrome_client/components/album_list_item.dart';
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
          SnackBar(content: Text('failed to load albums: ${e.toString().toLowerCase()}')),
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
      appBar: AppBar(
        title: const Text('navidrome'),
        centerTitle: true,
        actions: [
          IconButton(
            onPressed: _handleLogout,
            icon: const Icon(Icons.logout),
            tooltip: 'logout',
          ),
        ],
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () => _loadAlbums(refresh: true),
          child: _isLoading && _albums.isEmpty
              ? const Center(child: CircularProgressIndicator())
              : _albums.isEmpty
                  ? const Center(child: Text('no albums found'))
                  : ListView.builder(
                      controller: _scrollController,
                      itemCount: _albums.length + (_hasMore ? 1 : 0),
                      itemBuilder: (context, index) {
                        if (index == _albums.length) {
                          return const Padding(
                            padding: EdgeInsets.all(16.0),
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
                    ),
        ),
      ),
    );
  }
}
