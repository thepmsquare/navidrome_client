import 'package:flutter/material.dart';
import 'package:just_audio/just_audio.dart';
import 'package:navidrome_client/services/player_service.dart';
import 'package:navidrome_client/services/api_service.dart';

class MiniPlayer extends StatelessWidget {
  final ApiService? apiService;
  final VoidCallback onTap;

  const MiniPlayer({
    super.key,
    this.apiService,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final playerService = PlayerService();
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return StreamBuilder<int?>(
      stream: playerService.currentIndexStream,
      builder: (context, snapshot) {
        final track = playerService.currentTrack;
        if (track == null) return const SizedBox.shrink();

        // note: we are preserving the original case from the api for metadata.
        final title = (track['title'] ?? 'unknown title').toString();
        final artist = (track['artist'] ?? 'unknown artist').toString();
        final coverArtId = track['coverArt'];
        final coverArtUrl = coverArtId != null && apiService != null
            ? apiService!.getCoverArtUrl(coverArtId)
            : null;

        return Padding(
          padding: const EdgeInsets.only(left: 12, right: 12, bottom: 12),
          child: GestureDetector(
            onTap: onTap,
            child: Card(
              elevation: 4,
              shadowColor: Colors.black.withValues(alpha: 0.2),
              color: colorScheme.surfaceContainerHighest,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(20),
              ),
              child: Container(
                height: 72,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                child: Row(
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(12),
                      child: SizedBox(
                        width: 56,
                        height: 56,
                        child: coverArtUrl != null
                            ? Image.network(
                                coverArtUrl,
                                fit: BoxFit.cover,
                                errorBuilder: (context, error, stackTrace) => _buildPlaceholder(),
                              )
                            : _buildPlaceholder(),
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            title,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: theme.textTheme.titleMedium?.copyWith(
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          Text(
                            artist,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: theme.textTheme.bodyMedium?.copyWith(
                              color: colorScheme.onSurfaceVariant,
                            ),
                          ),
                        ],
                      ),
                    ),
                    StreamBuilder<PlayerState>(
                      stream: playerService.player.playerStateStream,
                      builder: (context, snapshot) {
                        final playerState = snapshot.data;
                        final processingState = playerState?.processingState;
                        final playing = playerState?.playing ?? false;

                        if (processingState == ProcessingState.loading ||
                            processingState == ProcessingState.buffering) {
                          return const Padding(
                            padding: EdgeInsets.all(8.0),
                            child: SizedBox(
                              width: 24,
                              height: 24,
                              child: CircularProgressIndicator(strokeWidth: 3),
                            ),
                          );
                        }

                        return IconButton.filledTonal(
                          onPressed: () {
                            if (playing) {
                              playerService.pause();
                            } else {
                              playerService.resume();
                            }
                          },
                          icon: Icon(
                            playing ? Icons.pause_rounded : Icons.play_arrow_rounded,
                            size: 32,
                          ),
                        );
                      },
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildPlaceholder() {
    return Container(
      color: Colors.grey.withValues(alpha: 0.1),
      child: const Icon(Icons.music_note_rounded, size: 28, color: Colors.grey),
    );
  }
}
