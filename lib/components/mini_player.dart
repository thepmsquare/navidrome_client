import 'package:flutter/material.dart';
import 'package:just_audio/just_audio.dart';
import 'package:navidrome_client/services/player_service.dart';
import 'package:navidrome_client/services/api_service.dart';
import 'package:navidrome_client/components/offline_image.dart';

class MiniPlayer extends StatefulWidget {
  final ApiService? apiService;
  final VoidCallback onTap;

  const MiniPlayer({super.key, this.apiService, required this.onTap});

  @override
  State<MiniPlayer> createState() => _MiniPlayerState();
}

class _MiniPlayerState extends State<MiniPlayer> {
  bool _hasTriggered = false;

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
        final coverArtUrl = coverArtId != null && widget.apiService != null
            ? widget.apiService!.getCoverArtUrl(coverArtId)
            : null;

        return Padding(
          padding: const EdgeInsets.only(left: 12, right: 12, bottom: 12),
          child: GestureDetector(
            onTap: widget.onTap,
            onVerticalDragUpdate: (details) {
              if (!_hasTriggered && details.primaryDelta! < -5) {
                setState(() => _hasTriggered = true);
                widget.onTap();
              }
            },
            onVerticalDragEnd: (_) => setState(() => _hasTriggered = false),
            onVerticalDragCancel: () => setState(() => _hasTriggered = false),
            onHorizontalDragUpdate: (details) {
              if (!_hasTriggered) {
                if (details.primaryDelta! > 10) {
                  setState(() => _hasTriggered = true);
                  playerService.skipToPrevious().catchError((_) {});
                } else if (details.primaryDelta! < -10) {
                  setState(() => _hasTriggered = true);
                  playerService.skipToNext().catchError((_) {});
                }
              }
            },
            onHorizontalDragEnd: (_) => setState(() => _hasTriggered = false),
            onHorizontalDragCancel: () => setState(() => _hasTriggered = false),
            child: Card(
              elevation: 4,
              shadowColor: Colors.black.withValues(alpha: 0.2),
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
                    ClipRRect(
                      borderRadius: BorderRadius.circular(12),
                      child: SizedBox(
                        width: 56,
                        height: 56,
                        child: AnimatedSwitcher(
                          duration: const Duration(milliseconds: 300),
                          child: OfflineImage(
                            key: ValueKey(coverArtId?.toString() ?? 'placeholder'),
                            coverArtId: coverArtId?.toString(),
                            remoteUrl: coverArtUrl,
                            fit: BoxFit.cover,
                            placeholder: _buildPlaceholder(),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          AnimatedSwitcher(
                            duration: const Duration(milliseconds: 300),
                            child: Align(
                              alignment: Alignment.centerLeft,
                              child: Text(
                                title,
                                key: ValueKey('title_$title'),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: theme.textTheme.titleMedium?.copyWith(
                                  fontWeight: FontWeight.bold,
                                  color: colorScheme.onSecondaryContainer,
                                ),
                              ),
                            ),
                          ),
                          AnimatedSwitcher(
                            duration: const Duration(milliseconds: 300),
                            child: Align(
                              alignment: Alignment.centerLeft,
                              child: Text(
                                artist,
                                key: ValueKey('artist_$artist'),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: theme.textTheme.bodyMedium?.copyWith(
                                  color: colorScheme.onSecondaryContainer
                                      .withValues(alpha: 0.7),
                                ),
                              ),
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
                                playing
                                    ? Icons.pause_rounded
                                    : Icons.play_arrow_rounded,
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
