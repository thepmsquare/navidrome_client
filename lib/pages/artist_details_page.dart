import 'package:flutter/material.dart';
import 'package:navidrome_client/components/album_list_item.dart';
import 'package:navidrome_client/pages/album_details_page.dart';
import 'package:navidrome_client/services/api_service.dart';
import 'package:navidrome_client/services/offline_service.dart';
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

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final isOfflineMode = OfflineService().isOfflineMode;

    final String artistName = (widget.artist['name'] ?? 'unknown artist').toString();
    final String? coverArtId = widget.artist['coverArt']?.toString();
    final String? coverArtUrl = coverArtId != null
        ? widget.apiService.getCoverArtUrl(coverArtId, size: 600)
        : null;

    return Scaffold(
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            pinned: true,
            expandedHeight: 250,
            backgroundColor: colorScheme.surface,
            flexibleSpace: FlexibleSpaceBar(
              title: Text(
                artistName,
                style: theme.textTheme.headlineSmall?.copyWith(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                  shadows: const [
                    Shadow(blurRadius: 12, color: Colors.black54, offset: Offset(0, 2)),
                  ],
                ),
              ),
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
                    );
                  },
                  childCount: _albums.length,
                ),
              ),
            ),
        ],
      ),
    );
  }
}
