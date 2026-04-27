import 'package:flutter/material.dart';
import 'package:navidrome_client/components/album_list_item.dart';
import 'package:navidrome_client/components/mini_player.dart';
import 'package:navidrome_client/pages/album_details_page.dart';
import 'package:navidrome_client/pages/player_page.dart';
import 'package:navidrome_client/services/api_service.dart';
import 'package:navidrome_client/services/player_service.dart';
import 'package:navidrome_client/components/offline_image.dart';

class ArtistDetailsPage extends StatefulWidget {
  final Map<String, dynamic> artist;
  final ApiService apiService;

  const ArtistDetailsPage({
    super.key,
    required this.artist,
    required this.apiService,
  });

  @override
  State<ArtistDetailsPage> createState() => _ArtistDetailsPageState();
}

class _ArtistDetailsPageState extends State<ArtistDetailsPage> {
  List<Map<String, dynamic>> _albums = [];
  bool _isLoading = true;
  bool _isPlayingArtist = false;

  @override
  void initState() {
    super.initState();
    _loadArtistDetails();
  }

  Future<void> _loadArtistDetails() async {
    try {
      final artistId = widget.artist['id'].toString();
      final artistDetails = await widget.apiService.getArtist(artistId);
      
      if (artistDetails != null && mounted) {
        final albumsData = artistDetails['album'];
        List<Map<String, dynamic>> albums = [];
        if (albumsData is List) {
          albums = List<Map<String, dynamic>>.from(albumsData);
        } else if (albumsData is Map) {
          albums = [Map<String, dynamic>.from(albumsData)];
        }

        setState(() {
          _albums = albums;
          _isLoading = false;
        });
      } else if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('failed to load artist details: ${e.toString()}')),
        );
      }
    }
  }

  Future<void> _playArtist() async {
    if (_isPlayingArtist) return;

    setState(() => _isPlayingArtist = true);

    try {
      final artistId = widget.artist['id'].toString();
      final tracks = await widget.apiService.getArtistTracks(artistId);

      if (tracks.isEmpty) {
        // Fallback: try to get tracks from the first few albums if getSongsByArtist returned nothing
        // (though Navidrome should support it).
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('no tracks found for this artist')),
          );
        }
      } else {
        await PlayerService().play(tracks, 0, widget.apiService);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('failed to play artist: ${e.toString()}')),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isPlayingArtist = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    final String artistName = (widget.artist['name'] ?? 'unknown artist').toString();
    final String? coverArtId = widget.artist['coverArt']?.toString();
    final String? coverArtUrl = coverArtId != null
        ? widget.apiService.getCoverArtUrl(coverArtId, size: 600)
        : null;

    return Scaffold(
      body: Stack(
        children: [
          CustomScrollView(
            slivers: [
              SliverAppBar(
                pinned: true,
                expandedHeight: 250,
                backgroundColor: colorScheme.surface,
                flexibleSpace: FlexibleSpaceBar(
                  title: Row(
                    children: [
                      IconButton.filled(
                        icon: const Icon(Icons.play_arrow_rounded, size: 24),
                        onPressed: _isLoading || _isPlayingArtist ? null : _playArtist,
                        style: IconButton.styleFrom(
                          backgroundColor: colorScheme.primary,
                          foregroundColor: colorScheme.onPrimary,
                          padding: const EdgeInsets.all(8),
                          elevation: 4,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: SingleChildScrollView(
                          scrollDirection: Axis.horizontal,
                          child: Text(
                            artistName,
                            style: theme.textTheme.headlineSmall?.copyWith(
                              color: Colors.white,
                              fontWeight: FontWeight.bold,
                              shadows: const [
                                Shadow(blurRadius: 12, color: Colors.black54, offset: Offset(0, 2)),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                  titlePadding: const EdgeInsets.only(left: 16, bottom: 16, right: 16),
                  background: Stack(
                    fit: StackFit.expand,
                    children: [
                      OfflineImage(
                        coverArtId: coverArtId,
                        remoteUrl: coverArtUrl,
                        fit: BoxFit.cover,
                        placeholder: Container(color: colorScheme.surfaceContainerHighest),
                      ),
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
              else if (_albums.isEmpty)
                const SliverFillRemaining(
                  child: Center(child: Text('no albums found for this artist')),
                )
              else
                SliverPadding(
                  padding: const EdgeInsets.only(top: 8, bottom: 100),
                  sliver: SliverList(
                    delegate: SliverChildBuilderDelegate(
                      (context, index) {
                        final album = _albums[index];
                        final albumCoverArtId = album['coverArt'];
                        final String? albumCoverArtUrl = albumCoverArtId != null
                            ? widget.apiService.getCoverArtUrl(albumCoverArtId)
                            : null;

                        return AlbumListItem(
                          album: album,
                          coverArtUrl: albumCoverArtUrl,
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
                          onArtistTap: (artist) {
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (context) => ArtistDetailsPage(
                                  artist: {
                                    ...artist,
                                    'coverArt': artist['coverArt'] ?? album['coverArt'],
                                  },
                                  apiService: widget.apiService,
                                ),
                              ),
                            );
                          },
                        );
                      },
                      childCount: _albums.length,
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
