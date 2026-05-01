import 'package:flutter/material.dart';
import 'package:navidrome_client/services/player_service.dart';
import 'package:navidrome_client/services/api_service.dart';
import 'package:navidrome_client/components/offline_image.dart';
import 'package:just_audio/just_audio.dart';

class MiniPlayerView extends StatelessWidget {
  final ApiService apiService;
  final PageController pageController;
  final VoidCallback onTap;

  const MiniPlayerView({
    super.key,
    required this.apiService,
    required this.pageController,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final playerService = PlayerService();

    return StreamBuilder<int?>(
      stream: playerService.currentIndexStream,
      builder: (context, snapshot) {
        final track = playerService.currentTrack;
        if (track == null) return const SizedBox.shrink();

        return Card(
          elevation: 0, // miniplayer package handles its own shadow/elevation usually
          margin: EdgeInsets.zero,
          color: colorScheme.secondaryContainer,
          shape: RoundedRectangleBorder(
            side: BorderSide(
              color: colorScheme.outlineVariant.withValues(alpha: 0.3),
              width: 1,
            ),
            borderRadius: BorderRadius.circular(20),
          ),
          child: Container(
            height: 72,
            padding: const EdgeInsets.symmetric(
              horizontal: 12,
              vertical: 8,
            ),
            child: Row(
              children: [
                SizedBox(
                  width: 56,
                  height: 56,
                  child: PageView.builder(
                    controller: pageController,
                    onPageChanged: (index) {
                      playerService.seekToIndex(index).catchError((_) {});
                    },
                    itemCount: playerService.currentQueue.length,
                    itemBuilder: (context, index) {
                      final itemTrack = playerService.currentQueue[index];
                      final itemCoverArtId = itemTrack['coverArt'];
                      final itemCoverArtUrl = itemCoverArtId != null
                          ? apiService.getCoverArtUrl(itemCoverArtId)
                          : null;

                      return ClipRRect(
                        borderRadius: BorderRadius.circular(12),
                        child: OfflineImage(
                          key: ValueKey(itemCoverArtId?.toString() ?? 'placeholder_$index'),
                          coverArtId: itemCoverArtId?.toString(),
                          remoteUrl: itemCoverArtUrl,
                          fit: BoxFit.cover,
                          placeholder: _buildPlaceholder(),
                        ),
                      );
                    },
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: AnimatedSwitcher(
                    duration: const Duration(milliseconds: 300),
                    child: Column(
                      key: ValueKey('mini_metadata_${track['id']}'),
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          (track['title'] ?? 'unknown title').toString(),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: theme.textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.bold,
                            color: colorScheme.onSecondaryContainer,
                          ),
                        ),
                        Text(
                          (track['artist'] ?? 'unknown artist').toString(),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: theme.textTheme.bodyMedium?.copyWith(
                            color: colorScheme.onSecondaryContainer.withValues(alpha: 0.7),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 8),
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

                    return Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        IconButton(
                          onPressed: () => playerService.skipToPrevious().catchError((_) {}),
                          icon: const Icon(Icons.skip_previous_rounded, size: 28),
                        ),
                        IconButton.filledTonal(
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
                        ),
                        IconButton(
                          onPressed: () => playerService.skipToNext().catchError((_) {}),
                          icon: const Icon(Icons.skip_next_rounded, size: 28),
                        ),
                      ],
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
      color: Colors.grey.withValues(alpha: 0.1),
      child: const Icon(Icons.music_note_rounded, size: 28, color: Colors.grey),
    );
  }
}
