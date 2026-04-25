import 'package:flutter/material.dart';
import 'package:navidrome_client/services/api_service.dart';
import 'package:navidrome_client/services/player_service.dart';
import 'package:navidrome_client/components/offline_image.dart';

class AlbumTile extends StatelessWidget {
  final Map<String, dynamic> album;
  final ApiService apiService;
  final VoidCallback onTap;
  final VoidCallback? onArtistTap;

  const AlbumTile({
    super.key,
    required this.album,
    required this.apiService,
    required this.onTap,
    this.onArtistTap,
  });

  Future<void> _playAlbum(BuildContext context) async {
    try {
      final String albumId = album['id'].toString();
      final tracks = await apiService.getTracks(albumId);
      if (tracks.isNotEmpty) {
        await PlayerService().play(tracks, 0, apiService);
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('failed to play album: ${e.toString()}')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    final String name = (album['name'] ?? 'unknown album').toString();
    final String artist = (album['artist'] ?? 'unknown artist').toString();
    final String? coverArtId = album['coverArt']?.toString();
    final String? coverArtUrl = coverArtId != null
        ? apiService.getCoverArtUrl(coverArtId, size: 300)
        : null;

    return SizedBox(
      width: 160,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Stack(
            children: [
              InkWell(
                onTap: onTap,
                borderRadius: BorderRadius.circular(16),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(16),
                  child: AspectRatio(
                    aspectRatio: 1,
                    child: OfflineImage(
                      coverArtId: coverArtId,
                      remoteUrl: coverArtUrl,
                      fit: BoxFit.cover,
                      placeholder: Container(
                        color: colorScheme.surfaceContainerHighest,
                        child: const Icon(Icons.album_rounded, size: 48, color: Colors.grey),
                      ),
                    ),
                  ),
                ),
              ),
              Positioned(
                right: 8,
                bottom: 8,
                child: Material(
                  color: Colors.transparent,
                  child: InkWell(
                    onTap: () => _playAlbum(context),
                    borderRadius: BorderRadius.circular(24),
                    child: Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: colorScheme.primary,
                        shape: BoxShape.circle,
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.3),
                            blurRadius: 8,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: Icon(
                        Icons.play_arrow_rounded,
                        color: colorScheme.onPrimary,
                        size: 24,
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
                GestureDetector(
                  onTap: onArtistTap,
                  child: Text(
                    artist,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: onArtistTap != null 
                          ? colorScheme.primary 
                          : colorScheme.onSurfaceVariant,
                      fontWeight: onArtistTap != null ? FontWeight.bold : FontWeight.normal,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
