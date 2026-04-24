import 'dart:async';
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
  final PlayerService _playerService = PlayerService();
  late final PageController _pageController;
  late final StreamSubscription<int?> _currentIndexSubscription;
  bool _hasTriggered = false;

  @override
  void initState() {
    super.initState();
    final initialPage = _playerService.player.currentIndex ?? 0;
    _pageController = PageController(initialPage: initialPage);

    _currentIndexSubscription = _playerService.currentIndexStream.listen((index) {
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
    _currentIndexSubscription.cancel();
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final playerService = PlayerService();
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return StreamBuilder<int?>(
      stream: _playerService.currentIndexStream,
      builder: (context, snapshot) {
        final track = _playerService.currentTrack;
        if (track == null) return const SizedBox.shrink();

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
                    Expanded(
                      child: PageView.builder(
                        controller: _pageController,
                        onPageChanged: (index) {
                          _playerService.seekToIndex(index).catchError((_) {});
                        },
                        itemCount: _playerService.currentQueue.length,
                        itemBuilder: (context, index) {
                          final itemTrack = _playerService.currentQueue[index];
                          final itemTitle = (itemTrack['title'] ?? 'unknown title').toString();
                          final itemArtist = (itemTrack['artist'] ?? 'unknown artist').toString();
                          final itemCoverArtId = itemTrack['coverArt'];
                          final itemCoverArtUrl = itemCoverArtId != null && widget.apiService != null
                              ? widget.apiService!.getCoverArtUrl(itemCoverArtId)
                              : null;

                          return Row(
                            children: [
                              ClipRRect(
                                borderRadius: BorderRadius.circular(12),
                                child: SizedBox(
                                  width: 56,
                                  height: 56,
                                  child: OfflineImage(
                                    key: ValueKey(itemCoverArtId?.toString() ?? 'placeholder_$index'),
                                    coverArtId: itemCoverArtId?.toString(),
                                    remoteUrl: itemCoverArtUrl,
                                    fit: BoxFit.cover,
                                    placeholder: _buildPlaceholder(),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 16),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Text(
                                      itemTitle,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: theme.textTheme.titleMedium?.copyWith(
                                        fontWeight: FontWeight.bold,
                                        color: colorScheme.onSecondaryContainer,
                                      ),
                                    ),
                                    Text(
                                      itemArtist,
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
                            ],
                          );
                        },
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
                              onPressed: () => _playerService.skipToPrevious().catchError((_) {}),
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
                              onPressed: () => _playerService.skipToNext().catchError((_) {}),
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
