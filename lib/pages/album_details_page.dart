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
          // note: we are preserving the original case from the api for error messages.
          SnackBar(content: Text('failed to load tracks: ${e.toString()}')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    // note: we are preserving the original case from the api for metadata.
    final String albumName = (widget.album['name'] ?? 'unknown album').toString();
    final String? coverArtId = widget.album['coverArt'];
    final String? coverArtUrl = coverArtId != null ? widget.apiService.getCoverArtUrl(coverArtId, size: 600) : null;

    return Scaffold(
      body: Stack(
        children: [
          CustomScrollView(
            slivers: [
              SliverAppBar(
                pinned: true,
                expandedHeight: 300,
                backgroundColor: colorScheme.surface,
                flexibleSpace: FlexibleSpaceBar(
                  title: Text(
                    albumName,
                    style: theme.textTheme.headlineSmall?.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                      shadows: [
                        const Shadow(
                          blurRadius: 12,
                          color: Colors.black54,
                          offset: Offset(0, 2),
                        ),
                      ],
                    ),
                  ),
                  titlePadding: const EdgeInsets.only(left: 56, bottom: 16),
                  background: Stack(
                    fit: StackFit.expand,
                    children: [
                      if (coverArtUrl != null)
                        Image.network(
                          coverArtUrl,
                          fit: BoxFit.cover,
                        )
                      else
                        Container(color: colorScheme.surfaceContainerHighest),
                      DecoratedBox(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                            colors: [
                              Colors.transparent,
                              Colors.black.withValues(alpha: 0.6),
                            ],
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
                SliverPadding(
                  padding: const EdgeInsets.only(top: 8, bottom: 100),
                  sliver: SliverList(
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
                ),
            ],
          ),
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: MiniPlayer(
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
          ),
        ],
      ),
    );
  }
}
