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

    return StreamBuilder<int?>(
      stream: playerService.currentIndexStream,
      builder: (context, snapshot) {
        final track = playerService.currentTrack;
        if (track == null) return const SizedBox.shrink();

        final title = (track['title'] ?? 'unknown title').toString().toLowerCase();
        final artist = (track['artist'] ?? 'unknown artist').toString().toLowerCase();
        final coverArtId = track['coverArt'];
        final coverArtUrl = coverArtId != null && apiService != null
            ? apiService!.getCoverArtUrl(coverArtId)
            : null;

        return GestureDetector(
          onTap: onTap,
          child: Container(
            height: 64,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.surfaceContainerHigh,
              border: Border(
                top: BorderSide(
                  color: Theme.of(context).dividerColor.withValues(alpha: 0.1),
                ),
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.05),
                  blurRadius: 4,
                  offset: const Offset(0, -2),
                ),
              ],
            ),
            child: Row(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: SizedBox(
                    width: 48,
                    height: 48,
                    child: coverArtUrl != null
                        ? Image.network(
                            coverArtUrl,
                            fit: BoxFit.cover,
                            errorBuilder: (context, error, stackTrace) => _buildPlaceholder(),
                          )
                        : _buildPlaceholder(),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                              fontWeight: FontWeight.bold,
                            ),
                      ),
                      Text(
                        artist,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: Theme.of(context).colorScheme.outline,
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
                          child: CircularProgressIndicator(strokeWidth: 2),
                        ),
                      );
                    }

                    return IconButton(
                      onPressed: () {
                        if (playing) {
                          playerService.pause();
                        } else {
                          playerService.resume();
                        }
                      },
                      icon: Icon(
                        playing ? Icons.pause : Icons.play_arrow,
                        size: 32,
                      ),
                    );
                  },
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildPlaceholder() {
    return Container(
      color: Colors.grey.withValues(alpha: 0.2),
      child: const Icon(Icons.music_note_outlined, size: 24, color: Colors.grey),
    );
  }
}
