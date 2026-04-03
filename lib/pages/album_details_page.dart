import 'package:flutter/material.dart';
import 'package:navidrome_client/components/track_list_item.dart';
import 'package:navidrome_client/components/mini_player.dart';
import 'package:navidrome_client/pages/player_page.dart';
import 'package:navidrome_client/services/api_service.dart';
import 'package:navidrome_client/services/player_service.dart';

class AlbumDetailsPage extends StatefulWidget {
  final Map<String, dynamic> album;
  final ApiService apiService;

  const AlbumDetailsPage({
    super.key,
    required this.album,
    required this.apiService,
  });

  @override
  State<AlbumDetailsPage> createState() => _AlbumDetailsPageState();
}

class _AlbumDetailsPageState extends State<AlbumDetailsPage> {
  List<Map<String, dynamic>> _tracks = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadTracks();
  }

  Future<void> _loadTracks() async {
    try {
      final tracks = await widget.apiService.getTracks(widget.album['id']);
      setState(() {
        _tracks = tracks;
        _isLoading = false;
      });
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('failed to load tracks: ${e.toString().toLowerCase()}')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final String albumName = (widget.album['name'] ?? 'unknown album').toString().toLowerCase();
    final String? coverArtId = widget.album['coverArt'];
    final String? coverArtUrl = coverArtId != null ? widget.apiService.getCoverArtUrl(coverArtId, size: 400) : null;

    return Scaffold(
      body: Column(
        children: [
          Expanded(
            child: CustomScrollView(
              slivers: [
                SliverAppBar(
                  pinned: true,
                  expandedHeight: 300,
                  flexibleSpace: FlexibleSpaceBar(
                    title: Text(
                      albumName,
                      style: const TextStyle(
                        color: Colors.white,
                        shadows: [Shadow(blurRadius: 4, color: Colors.black45, offset: Offset(2, 2))],
                        fontSize: 16,
                      ),
                    ),
                    background: Stack(
                      fit: StackFit.expand,
                      children: [
                        if (coverArtUrl != null)
                          Image.network(
                            coverArtUrl,
                            fit: BoxFit.cover,
                          )
                        else
                          Container(color: Theme.of(context).colorScheme.surfaceContainerHighest),
                        Container(
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              begin: Alignment.topCenter,
                              end: Alignment.bottomCenter,
                              colors: [Colors.black.withValues(alpha: 0.0), Colors.black.withValues(alpha: 0.7)],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                if (_isLoading)
                  const SliverFillRemaining(
                    child: Center(child: CircularProgressIndicator()),
                  )
                else if (_tracks.isEmpty)
                  const SliverFillRemaining(
                    child: Center(child: Text('no tracks in this album')),
                  )
                else
                  SliverList(
                    delegate: SliverChildBuilderDelegate(
                      (context, index) {
                        final track = _tracks[index];
                        final trackCoverArtId = track['coverArt'] ?? widget.album['coverArt'];
                        final trackCoverArtUrl = trackCoverArtId != null 
                          ? widget.apiService.getCoverArtUrl(trackCoverArtId) 
                          : null;

                        return TrackListItem(
                          track: track,
                          coverArtUrl: trackCoverArtUrl,
                          onTap: () {
                            PlayerService().play(_tracks, index, widget.apiService);
                          },
                        );
                      },
                      childCount: _tracks.length,
                    ),
                  ),
              ],
            ),
          ),
          MiniPlayer(
            apiService: widget.apiService,
            onTap: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (context) => PlayerPage(apiService: widget.apiService),
                  fullscreenDialog: true,
                ),
              );
            },
          ),
        ],
      ),
    );
  }
}
