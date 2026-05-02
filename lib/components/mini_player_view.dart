import 'dart:async';
import 'package:flutter/material.dart';
import 'package:navidrome_client/services/player_service.dart';
import 'package:navidrome_client/services/api_service.dart';
import 'package:navidrome_client/components/offline_image.dart';
import 'package:just_audio/just_audio.dart';

class MiniPlayerView extends StatefulWidget {
  final ApiService apiService;
  final VoidCallback onTap;

  const MiniPlayerView({
    super.key,
    required this.apiService,
    required this.onTap,
  });

  @override
  State<MiniPlayerView> createState() => _MiniPlayerViewState();
}

class _MiniPlayerViewState extends State<MiniPlayerView> {
  final _playerService = PlayerService();
  late final PageController _pageController;
  late final StreamSubscription<int?> _indexSubscription;

  @override
  void initState() {
    super.initState();
    final initialPage = _playerService.player.currentIndex ?? 0;
    _pageController = PageController(initialPage: initialPage);

    // Keep the album art PageView in sync when the player advances tracks
    // (e.g. auto-next, skip, or a swipe from the full PlayerView).
    _indexSubscription = _playerService.currentIndexStream.listen((index) {
      if (index != null && _pageController.hasClients) {
        if (_pageController.page?.round() != index) {
          _pageController.animateToPage(
            index,
            duration: const Duration(milliseconds: 300),
            curve: Curves.easeInOut,
          );
        }
      }
    });
  }

  @override
  void dispose() {
    _indexSubscription.cancel();
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return StreamBuilder<int?>(
      stream: _playerService.currentIndexStream,
      builder: (context, snapshot) {
        final track = _playerService.currentTrack;
        if (track == null) return const SizedBox.shrink();

        return Card(
          elevation: 0,
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
                // Album art — explicit 56×56 so OfflineImage has a definite
                // size to render into inside the PageView's scroll direction.
                SizedBox(
                  width: 56,
                  height: 56,
                  child: PageView.builder(
                    controller: _pageController,
                    onPageChanged: (index) {
                      _playerService.seekToIndex(index).catchError((_) {});
                    },
                    itemCount: _playerService.currentQueue.length,
                    itemBuilder: (context, index) {
                      final itemTrack = _playerService.currentQueue[index];
                      final itemCoverArtId = itemTrack['coverArt'];
                      final itemCoverArtUrl = itemCoverArtId != null
                          ? widget.apiService.getCoverArtUrl(itemCoverArtId)
                          : null;

                      return ClipRRect(
                        borderRadius: BorderRadius.circular(12),
                        child: OfflineImage(
                          key: ValueKey(
                            itemCoverArtId?.toString() ?? 'placeholder_$index',
                          ),
                          coverArtId: itemCoverArtId?.toString(),
                          remoteUrl: itemCoverArtUrl,
                          width: 56,
                          height: 56,
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
                            color: colorScheme.onSecondaryContainer
                                .withValues(alpha: 0.7),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                StreamBuilder<PlayerState>(
                  stream: _playerService.player.playerStateStream,
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
                          onPressed: () =>
                              _playerService.skipToPrevious().catchError((_) {}),
                          icon: const Icon(Icons.skip_previous_rounded, size: 28),
                        ),
                        IconButton.filledTonal(
                          onPressed: () {
                            if (playing) {
                              _playerService.pause();
                            } else {
                              _playerService.resume();
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
                          onPressed: () =>
                              _playerService.skipToNext().catchError((_) {}),
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
