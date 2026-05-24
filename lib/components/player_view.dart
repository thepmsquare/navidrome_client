import 'dart:async';
import 'dart:io';
import 'dart:typed_data';
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:just_audio/just_audio.dart';
import 'package:navidrome_client/services/player_service.dart';
import 'package:navidrome_client/services/api_service.dart';
import 'package:navidrome_client/components/offline_image.dart';
import 'package:navidrome_client/components/queue_list_item.dart';
import 'package:navidrome_client/services/lyrics_service.dart';
import 'package:navidrome_client/pages/artist_details_page.dart';
import 'package:navidrome_client/pages/album_details_page.dart';
import 'package:navidrome_client/services/offline_service.dart';
import 'package:file_picker/file_picker.dart';
import 'package:http/http.dart' as http;

class PlayerView extends StatefulWidget {
  final ApiService apiService;
  final VoidCallback onMinimize;
  final bool isExpanded;

  const PlayerView({
    super.key,
    required this.apiService,
    required this.onMinimize,
    this.isExpanded = false,
  });

  @override
  State<PlayerView> createState() => _PlayerViewState();
}

class _PlayerViewState extends State<PlayerView> with WidgetsBindingObserver {
  final PlayerService _playerService = PlayerService();
  late final LyricsService _lyricsService;
  late PageController _pageController;
  late final PageController _verticalPageController;
  late final StreamSubscription<int?> _currentIndexSubscription;
  bool _showLyrics = false;
  double? _dragValue;
  // Guards against seekToIndex firing when the page change is programmatic
  // (e.g. the stream listener syncing the PageView to the player's current
  // index after a background song transition).
  // Uses a counter instead of a boolean to handle overlapping animations
  // caused by rapid stream emissions (e.g. multiple track skips while
  // backgrounded).  A cancelled animation's whenComplete would otherwise
  // clear a simple boolean flag while a subsequent animation is still
  // in-flight, allowing onPageChanged to fire seekToIndex and reset the
  // playback position to 00:00.
  int _programmaticAnimationCount = 0;

  String? _lastCheckedTrackId;
  bool? _lyricsAvailable;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _lyricsService = LyricsService(widget.apiService);

    final initialPage = _playerService.player.currentIndex ?? 0;
    _pageController = PageController(initialPage: initialPage);
    _verticalPageController = PageController(initialPage: 0);

    _currentIndexSubscription = _playerService.currentIndexStream.listen((index) {
      if (index != null) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (!mounted) return;
          if (_pageController.hasClients) {
            if (_pageController.page?.round() != index) {
              if (widget.isExpanded) {
                _programmaticAnimationCount++;
                _pageController.animateToPage(
                  index,
                  duration: const Duration(milliseconds: 300),
                  curve: Curves.easeInOut,
                ).whenComplete(() {
                  _programmaticAnimationCount--;
                });
              } else {
                _pageController.jumpToPage(index);
              }
            }
          } else {
            _pageController.dispose();
            _pageController = PageController(initialPage: index);
          }
        });
      }
    });
  }

  @override
  void didUpdateWidget(PlayerView oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.isExpanded && !oldWidget.isExpanded) {
      final currentIndex = _playerService.player.currentIndex;
      if (currentIndex != null && _pageController.hasClients) {
        if (_pageController.page?.round() != currentIndex) {
          _pageController.jumpToPage(currentIndex);
        }
      }
    }
  }

  void _checkLyricsAvailability(Map<String, dynamic>? track) async {
    if (track == null) {
      if (mounted) {
        setState(() {
          _lastCheckedTrackId = null;
          _lyricsAvailable = false;
        });
      }
      return;
    }
    final trackId = track['id']?.toString();
    if (trackId == _lastCheckedTrackId) return;

    if (mounted) {
      setState(() {
        _lastCheckedTrackId = trackId;
        _lyricsAvailable = null;
      });
    }

    try {
      final lyrics = await _lyricsService.getLyrics(track);
      final hasLyrics = lyrics != null && (lyrics.plain != null || lyrics.hasSynced);
      if (mounted && trackId == _lastCheckedTrackId) {
        setState(() {
          _lyricsAvailable = hasLyrics;
        });
      }
    } catch (e) {
      if (mounted && trackId == _lastCheckedTrackId) {
        setState(() {
          _lyricsAvailable = false;
        });
      }
    }
  }

  @override
  void dispose() {
    _currentIndexSubscription.cancel();
    _pageController.dispose();
    _verticalPageController.dispose();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      // Force UI refresh on resume to sync the timeline/slider with the
      // latest player position.
      setState(() {});
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return PopScope(
      canPop: !widget.isExpanded,
      onPopInvokedWithResult: (didPop, result) async {
        if (didPop) return;

        if (_verticalPageController.hasClients &&
            _verticalPageController.page?.round() == 1) {
          _verticalPageController.animateToPage(
            0,
            duration: const Duration(milliseconds: 300),
            curve: Curves.easeInOut,
          );
          return;
        }

        widget.onMinimize();
      },
      child: NotificationListener<ScrollNotification>(
        onNotification: (notification) {
          if (_verticalPageController.hasClients &&
              _verticalPageController.page?.round() == 0) {
            if (notification is ScrollUpdateNotification) {
              if (notification.dragDetails != null &&
                  notification.metrics.pixels <= 0 &&
                  notification.scrollDelta != null &&
                  notification.scrollDelta! < -8) {
                widget.onMinimize();
              }
            } else if (notification is OverscrollNotification) {
              if (notification.dragDetails != null &&
                  notification.overscroll < -8) {
                widget.onMinimize();
              }
            }
          }
          return false;
        },
        child: PageView(
          controller: _verticalPageController,
          scrollDirection: Axis.vertical,
          children: [
            _buildNowPlayingView(context, colorScheme, theme),
            _buildQueueView(context, colorScheme, theme),
          ],
        ),
      ),
    );
  }

  Widget _buildNowPlayingView(
    BuildContext context,
    ColorScheme colorScheme,
    ThemeData theme,
  ) {
    return Column(
      children: [
        AppBar(
          leading: IconButton(
            icon: const Icon(Icons.expand_more_rounded),
            onPressed: widget.onMinimize,
          ),
          backgroundColor: Colors.transparent,
          elevation: 0,
          primary: true,
          centerTitle: true,
          title: ValueListenableBuilder<OfflineState>(
            valueListenable: OfflineService().offlineModeNotifier,
            builder: (context, state, child) {
              if (state == OfflineState.online) return const SizedBox.shrink();

              final bool isNoInternet = state == OfflineState.offlineNoInternet;
              final IconData icon = isNoInternet ? Icons.wifi_off_rounded : Icons.cloud_off_rounded;
              final String label = isNoInternet ? 'no internet' : 'offline mode';

              return Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: (isNoInternet ? colorScheme.errorContainer : colorScheme.tertiaryContainer).withValues(alpha: 0.8),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: (isNoInternet ? colorScheme.onErrorContainer : colorScheme.onTertiaryContainer).withValues(alpha: 0.15),
                    width: 1,
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      icon,
                      size: 14,
                      color: isNoInternet ? colorScheme.onErrorContainer : colorScheme.onTertiaryContainer,
                    ),
                    const SizedBox(width: 6),
                    Text(
                      label.toLowerCase(),
                      style: theme.textTheme.labelMedium?.copyWith(
                        color: isNoInternet ? colorScheme.onErrorContainer : colorScheme.onTertiaryContainer,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 0.5,
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
        ),
        Expanded(
          child: StreamBuilder<int?>(
            stream: _playerService.currentIndexStream,
            builder: (context, snapshot) {
              final track = _playerService.currentTrack;
              if (track == null) {
                return const Center(child: Text("no track playing"));
              }

              if (track['id']?.toString() != _lastCheckedTrackId) {
                WidgetsBinding.instance.addPostFrameCallback((_) {
                  _checkLyricsAvailability(track);
                });
              }

              return Center(
                key: const ValueKey('player'),
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 24.0,
                    vertical: 16.0,
                  ),
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 500),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Spacer(flex: 1),
                        Expanded(
                          flex: 20,
                          child: PageView.builder(
                            controller: _pageController,
                            padEnds: false,
                            onPageChanged: (index) {
                              if (_programmaticAnimationCount == 0) {
                                _playerService.seekToIndex(index).catchError((_) {});
                              }
                            },
                            itemCount: _playerService.currentQueue.length,
                            itemBuilder: (context, index) {
                              final itemTrack = _playerService.currentQueue[index];
                              final isCurrentTrack = track['id'] == itemTrack['id'];
                              final itemCoverArtId = itemTrack['coverArt'];
                              final itemCoverArtUrl = itemCoverArtId != null
                                  ? widget.apiService.getCoverArtUrl(
                                      itemCoverArtId,
                                      size: 800,
                                    )
                                  : null;

                              return Padding(
                                padding: const EdgeInsets.symmetric(horizontal: 4.0),
                                child: Column(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Flexible(
                                      child: AspectRatio(
                                        aspectRatio: 1,
                                        child: Container(
                                          decoration: BoxDecoration(
                                            borderRadius: BorderRadius.circular(40),
                                            boxShadow: [
                                              BoxShadow(
                                                color: colorScheme.shadow.withValues(alpha: 0.25),
                                                blurRadius: 50,
                                                offset: const Offset(0, 15),
                                                spreadRadius: -5,
                                              ),
                                            ],
                                          ),
                                          child: ClipRRect(
                                            borderRadius: BorderRadius.circular(10),
                                            child: Stack(
                                              fit: StackFit.expand,
                                              children: [
                                                OfflineImage(
                                                  coverArtId: itemCoverArtId?.toString(),
                                                  remoteUrl: itemCoverArtUrl,
                                                  fit: BoxFit.cover,
                                                  placeholder: Container(
                                                    color: colorScheme.surfaceContainerHighest,
                                                    child: Icon(
                                                      Icons.music_note_rounded,
                                                      size: 100,
                                                      color: colorScheme.primary.withValues(alpha: 0.5),
                                                    ),
                                                  ),
                                                ),
                                                if (_showLyrics && isCurrentTrack) ...[
                                                  Container(
                                                    color: Colors.black.withValues(alpha: 0.65),
                                                  ),
                                                  Positioned.fill(
                                                    child: BackdropFilter(
                                                      filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
                                                      child: Container(color: Colors.transparent),
                                                    ),
                                                  ),
                                                  _LyricsView(
                                                    key: ValueKey('lyrics_${itemTrack['id']}'),
                                                    track: itemTrack,
                                                    lyricsService: _lyricsService,
                                                    playerService: _playerService,
                                                  ),
                                                  Positioned(
                                                    top: 12,
                                                    right: 12,
                                                    child: IconButton(
                                                      icon: const Icon(Icons.close_rounded, color: Colors.white, size: 20),
                                                      style: IconButton.styleFrom(
                                                        backgroundColor: Colors.black.withValues(alpha: 0.5),
                                                        padding: const EdgeInsets.all(8),
                                                      ),
                                                      tooltip: 'close lyrics'.toLowerCase(),
                                                      onPressed: () => setState(() => _showLyrics = false),
                                                    ),
                                                  ),
                                                ] else if (isCurrentTrack && _lyricsAvailable == true) ...[
                                                  Positioned(
                                                    bottom: 12,
                                                    right: 12,
                                                    child: FilledButton.icon(
                                                      onPressed: () => setState(() => _showLyrics = true),
                                                      icon: const Icon(Icons.lyrics_rounded, size: 16),
                                                      label: Text('lyrics'.toLowerCase()),
                                                      style: FilledButton.styleFrom(
                                                        backgroundColor: Colors.black.withValues(alpha: 0.6),
                                                        foregroundColor: Colors.white,
                                                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                                        minimumSize: Size.zero,
                                                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                                      ),
                                                    ),
                                                  ),
                                                ],
                                              ],
                                            ),
                                          ),
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              );
                            },
                          ),
                        ),
                        const SizedBox(height: 16),
                        AnimatedSwitcher(
                          duration: const Duration(milliseconds: 300),
                          child: Column(
                            key: ValueKey('metadata_${track['id']}'),
                            children: [
                              Text(
                                (track['title'] ?? 'unknown title').toString(),
                                textAlign: TextAlign.center,
                                style: theme.textTheme.headlineMedium?.copyWith(
                                  fontWeight: FontWeight.bold,
                                  color: colorScheme.onSurface,
                                ),
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                              ),
                              const SizedBox(height: 6),
                              Center(
                                child: SingleChildScrollView(
                                  scrollDirection: Axis.horizontal,
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: _buildArtistWidgets(
                                            track,
                                            context,
                                            theme,
                                            colorScheme)
                                        .map((w) => Padding(
                                              padding: const EdgeInsets
                                                  .symmetric(
                                                  horizontal: 2),
                                              child: w,
                                            ))
                                        .toList(),
                                  ),
                                ),
                              ),
                              const SizedBox(height: 2),
                              GestureDetector(
                                onTap: () {
                                  final albumId = track['albumId']?.toString();
                                  if (albumId != null) {
                                    Navigator.push(
                                      context,
                                      MaterialPageRoute(
                                        builder: (context) => AlbumDetailsPage(
                                          album: {
                                            'id': albumId,
                                            'name': (track['album'] ?? 'unknown album').toString(),
                                            'coverArt': track['coverArt'],
                                          },
                                          apiService: widget.apiService,
                                        ),
                                      ),
                                    );
                                  }
                                },
                                child: Text(
                                  (track['album'] ?? 'unknown album').toString(),
                                  textAlign: TextAlign.center,
                                  style: theme.textTheme.bodyMedium?.copyWith(
                                    color: colorScheme.onSurfaceVariant,
                                    letterSpacing: 0.5,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              const SizedBox(height: 12),
                              _buildRatingWidget(track, colorScheme),
                            ],
                          ),
                        ),
                        const SizedBox(height: 16),
                        StreamBuilder<Duration>(
                          stream: _playerService.player.positionStream,
                          builder: (context, snapshot) {
                            final position = snapshot.data ?? _playerService.player.position;
                            final total = _playerService.player.duration ?? Duration.zero;

                            return Column(
                              children: [
                                SliderTheme(
                                  data: SliderTheme.of(context).copyWith(
                                    trackHeight: 8,
                                    thumbShape: const RoundSliderThumbShape(
                                      enabledThumbRadius: 6,
                                    ),
                                    overlayShape: const RoundSliderOverlayShape(
                                      overlayRadius: 16,
                                    ),
                                    activeTrackColor: colorScheme.primary,
                                    inactiveTrackColor: colorScheme.surfaceContainerHighest,
                                    thumbColor: colorScheme.primary,
                                  ),
                                  child: Slider(
                                    value: (_dragValue ?? position.inSeconds.toDouble()).clamp(
                                      0.0,
                                      total.inSeconds.toDouble().clamp(0.01, double.infinity),
                                    ),
                                    min: 0,
                                    max: total.inSeconds.toDouble().clamp(0.01, double.infinity),
                                    onChangeStart: (_) => setState(() => _dragValue = position.inSeconds.toDouble()),
                                    onChanged: (value) => setState(() => _dragValue = value),
                                    onChangeEnd: (value) {
                                      _playerService.seek(Duration(seconds: value.toInt()));
                                      setState(() => _dragValue = null);
                                    },
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Padding(
                                  padding: const EdgeInsets.symmetric(horizontal: 4.0),
                                  child: Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Text(
                                        _formatDuration(position),
                                        style: theme.textTheme.labelMedium?.copyWith(
                                          color: colorScheme.onSurfaceVariant,
                                          fontFeatures: const [FontFeature.tabularFigures()],
                                        ),
                                      ),
                                      Text(
                                        _formatDuration(total),
                                        style: theme.textTheme.labelMedium?.copyWith(
                                          color: colorScheme.onSurfaceVariant,
                                          fontFeatures: const [FontFeature.tabularFigures()],
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            );
                          },
                        ),
                        const Spacer(flex: 4),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                          children: [
                            StreamBuilder<bool>(
                              stream: _playerService.player.shuffleModeEnabledStream,
                              builder: (context, snapshot) {
                                final enabled = snapshot.data ?? false;
                                return IconButton(
                                  icon: const Icon(Icons.shuffle_rounded),
                                  onPressed: () => _playerService.toggleShuffleMode(),
                                  color: enabled ? colorScheme.primary : colorScheme.onSurfaceVariant,
                                  iconSize: 24,
                                  tooltip: 'shuffle',
                                );
                              },
                            ),
                            IconButton.filledTonal(
                              iconSize: 32,
                              icon: const Icon(Icons.skip_previous_rounded),
                              onPressed: () => _playerService.skipToPrevious().catchError((_) {}),
                            ),
                            StreamBuilder<PlayerState>(
                              stream: _playerService.player.playerStateStream,
                              builder: (context, snapshot) {
                                final playing = snapshot.data?.playing ?? false;
                                return IconButton.filled(
                                  iconSize: 56,
                                  padding: const EdgeInsets.all(16),
                                  icon: Icon(playing ? Icons.pause_rounded : Icons.play_arrow_rounded),
                                  onPressed: () {
                                    if (playing) {
                                      _playerService.pause();
                                    } else {
                                      _playerService.resume();
                                    }
                                  },
                                );
                              },
                            ),
                            IconButton.filledTonal(
                              iconSize: 32,
                              icon: const Icon(Icons.skip_next_rounded),
                              onPressed: () => _playerService.skipToNext().catchError((_) {}),
                            ),
                            StreamBuilder<LoopMode>(
                              stream: _playerService.player.loopModeStream,
                              builder: (context, snapshot) {
                                final mode = snapshot.data ?? LoopMode.off;
                                final isOff = mode == LoopMode.off;
                                final isOne = mode == LoopMode.one;

                                return IconButton(
                                  icon: Icon(isOne ? Icons.repeat_one_rounded : Icons.repeat_rounded),
                                  onPressed: () => _playerService.toggleLoopMode(),
                                  color: isOff ? colorScheme.onSurfaceVariant : colorScheme.primary,
                                  iconSize: 24,
                                  tooltip: 'repeat',
                                );
                              },
                            ),
                          ],
                        ),
                        const Spacer(flex: 3),
                        GestureDetector(
                          onTap: () {
                            _verticalPageController.animateToPage(
                              1,
                              duration: const Duration(milliseconds: 300),
                              curve: Curves.easeInOut,
                            );
                          },
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                Icons.keyboard_arrow_up_rounded,
                                size: 18,
                                color: colorScheme.onSurfaceVariant.withValues(alpha: 0.5),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                'swipe up for queue',
                                style: theme.textTheme.labelSmall?.copyWith(
                                  color: colorScheme.onSurfaceVariant.withValues(alpha: 0.6),
                                  letterSpacing: 1,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 8),
                      ],
                    ),
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildQueueView(
    BuildContext context,
    ColorScheme colorScheme,
    ThemeData theme,
  ) {
    return Column(
      children: [
        AppBar(
          leading: IconButton(
            icon: const Icon(Icons.keyboard_arrow_down_rounded),
            onPressed: () {
              _verticalPageController.animateToPage(
                0,
                duration: const Duration(milliseconds: 300),
                curve: Curves.easeInOut,
              );
            },
          ),
          backgroundColor: Colors.transparent,
          elevation: 0,
          primary: true,
          centerTitle: true,
          title: const Text('queue'),
          actions: [
            IconButton(
              icon: const Icon(Icons.delete_sweep_rounded),
              onPressed: () => _showClearConfirmation(context),
              tooltip: 'clear queue'.toLowerCase(),
            ),
          ],
        ),
        GestureDetector(
          onTap: () {
            _verticalPageController.animateToPage(
              0,
              duration: const Duration(milliseconds: 300),
              curve: Curves.easeInOut,
            );
          },
          child: Container(
            width: 40,
            height: 4,
            margin: const EdgeInsets.only(bottom: 12),
            decoration: BoxDecoration(
              color: colorScheme.onSurfaceVariant.withValues(alpha: 0.3),
              borderRadius: BorderRadius.circular(2),
            ),
          ),
        ),
        Expanded(
          child: StreamBuilder<int?>(
            stream: _playerService.currentIndexStream,
            builder: (context, snapshot) {
              final currentQueue = _playerService.currentQueue;
              final currentIndex = _playerService.player.currentIndex;

              if (currentQueue.isEmpty) {
                return Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        Icons.music_off_rounded,
                        size: 64,
                        color: colorScheme.onSurfaceVariant.withValues(alpha: 0.5),
                      ),
                      const SizedBox(height: 16),
                      Text(
                        'queue is empty',
                        style: theme.textTheme.titleMedium?.copyWith(
                          color: colorScheme.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ),
                );
              }

              return ReorderableListView.builder(
                itemCount: currentQueue.length,
                onReorder: (oldIndex, newIndex) {
                  if (newIndex > oldIndex) {
                    newIndex -= 1;
                  }
                  if (oldIndex != newIndex) {
                    setState(() {
                      _playerService.reorderQueue(oldIndex, newIndex);
                    });
                  }
                },
                itemBuilder: (context, index) {
                  final track = currentQueue[index];
                  final isPlaying = index == currentIndex;

                  return QueueListItem(
                    key: ValueKey('${track['id']}_$index'),
                    track: track,
                    index: index,
                    apiService: widget.apiService,
                    isPlaying: isPlaying,
                    onTap: () {
                      _playerService.seekToIndex(index).catchError((_) {});
                    },
                    onRemove: () {
                      setState(() {
                        _playerService.removeFromQueue(index);
                      });
                    },
                  );
                },
              );
            },
          ),
        ),
      ],
    );
  }

  Future<void> _showClearConfirmation(BuildContext context) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('clear queue?'),
        content: const Text('this will stop playback and empty the queue.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('clear'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      await _playerService.clearQueue();
      if (mounted) setState(() {});
    }
  }

  Widget _buildRatingWidget(Map<String, dynamic> track, ColorScheme colorScheme) {
    final int userRating = (track['userRating'] as num?)?.toInt() ?? 0;
    final String trackId = track['id']?.toString() ?? '';
    final bool isStarred = track['starred'] != null;

    return Stack(
      alignment: Alignment.center,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: List.generate(5, (index) {
            final starIndex = index + 1;
            final isSelected = starIndex <= userRating;

            return IconButton(
              visualDensity: VisualDensity.compact,
              padding: const EdgeInsets.symmetric(horizontal: 2),
              icon: Icon(
                isSelected ? Icons.star_rounded : Icons.star_outline_rounded,
                color: isSelected ? colorScheme.primary : colorScheme.onSurfaceVariant.withValues(alpha: 0.5),
                size: 28,
              ),
              onPressed: () {
                if (trackId.isEmpty) return;
                final newRating = (starIndex == userRating) ? 0 : starIndex;
                setState(() => track['userRating'] = newRating);
                _playerService.updateTrackRating(trackId, newRating);
                widget.apiService.setRating(trackId, newRating);
              },
            );
          }),
        ),
        Positioned(
          left: 0,
          child: IconButton(
            icon: Icon(
              isStarred ? Icons.favorite_rounded : Icons.favorite_border_rounded,
              color: isStarred ? Colors.redAccent : colorScheme.onSurfaceVariant.withValues(alpha: 0.5),
              size: 28,
            ),
            onPressed: () {
              if (trackId.isEmpty) return;
              final newStarred = !isStarred;
              setState(() {
                if (newStarred) {
                  track['starred'] = DateTime.now().toIso8601String();
                } else {
                  track.remove('starred');
                }
              });
              _playerService.updateTrackStarred(trackId, newStarred);
              if (newStarred) {
                widget.apiService.star(trackId);
              } else {
                widget.apiService.unstar(trackId);
              }
            },
          ),
        ),
        Positioned(
          right: 0,
          child: PopupMenuButton<String>(
            icon: Icon(
              Icons.more_vert_rounded,
              color: colorScheme.onSurfaceVariant.withValues(alpha: 0.8),
              size: 28,
            ),
            onSelected: (value) {
              if (value == 'lyrics') {
                setState(() => _showLyrics = !_showLyrics);
              } else if (value == 'queue') {
                _verticalPageController.animateToPage(
                  1,
                  duration: const Duration(milliseconds: 300),
                  curve: Curves.easeInOut,
                );
              } else if (value == 'download') {
                _downloadTrackToDevice(track);
              }
            },
            itemBuilder: (context) => [
              PopupMenuItem(
                value: 'lyrics',
                child: Row(
                  children: [
                    Icon(_showLyrics ? Icons.music_note_rounded : Icons.lyrics_rounded, size: 20),
                    const SizedBox(width: 12),
                    Text(_showLyrics ? 'show player' : 'show lyrics'),
                  ],
                ),
              ),
              const PopupMenuItem(
                value: 'queue',
                child: Row(
                  children: [
                    Icon(Icons.queue_music_rounded, size: 20),
                    SizedBox(width: 12),
                    Text('show queue'),
                  ],
                ),
              ),
              PopupMenuItem(
                value: 'download',
                child: Row(
                  children: [
                    const Icon(Icons.download_rounded, size: 20),
                    const SizedBox(width: 12),
                    Text('download track'.toLowerCase()),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Future<void> _downloadTrackToDevice(Map<String, dynamic> track) async {
    final trackId = track['id'] as String;
    final isOffline = OfflineService().isTrackOfflineSync(trackId);

    if (!isOffline && OfflineService().isOfflineMode) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('cannot download track while offline'.toLowerCase())),
      );
      return;
    }

    BuildContext? dialogContext;
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (BuildContext ctx) {
        dialogContext = ctx;
        return AlertDialog(
          content: Row(
            children: [
              const CircularProgressIndicator(),
              const SizedBox(width: 24),
              Text(
                (isOffline ? 'saving track...' : 'downloading track...')
                    .toLowerCase(),
              ),
            ],
          ),
        );
      },
    );

    try {
      Uint8List fileBytes;
      if (isOffline) {
        final localPath = await OfflineService().getLocalPath(trackId);
        if (localPath != null) {
          fileBytes = await File(localPath).readAsBytes();
        } else {
          throw Exception('local file not found');
        }
      } else {
        final streamUrl = widget.apiService.getStreamUrl(trackId);
        final response = await http.get(Uri.parse(streamUrl));
        if (response.statusCode == 200) {
          fileBytes = response.bodyBytes;
        } else {
          throw Exception('failed to download track: status ${response.statusCode}');
        }
      }

      if (dialogContext != null && dialogContext!.mounted) {
        Navigator.of(dialogContext!).pop();
        dialogContext = null;
      }

      final suffix = track['suffix'] ?? 'mp3';
      final title = track['title'] ?? 'unknown';
      final cleanTitle = title.toString().replaceAll(RegExp(r'[<>:"/\\|?*]'), '_');
      final fileName = '$cleanTitle.$suffix';

      final String? outputFile = await FilePicker.platform.saveFile(
        dialogTitle: 'save track'.toLowerCase(),
        fileName: fileName,
        type: FileType.audio,
        bytes: fileBytes,
      );

      if (outputFile != null) {
        final file = File(outputFile);
        if (!await file.exists()) {
          await file.writeAsBytes(fileBytes);
        }
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('track saved successfully'.toLowerCase())),
          );
        }
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('save cancelled'.toLowerCase())),
          );
        }
      }
    } catch (e) {
      if (dialogContext != null && dialogContext!.mounted) {
        Navigator.of(dialogContext!).pop();
      }
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('failed to save track: $e'.toLowerCase())),
        );
      }
    }
  }

  String _formatDuration(Duration d) {
    if (d == Duration.zero) return "0:00";
    final minutes = d.inMinutes;
    final seconds = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    return "$minutes:$seconds";
  }

  List<Widget> _buildArtistWidgets(Map<String, dynamic> track, BuildContext context, ThemeData theme, ColorScheme colorScheme) {
    final List<dynamic>? artists = track['artists'];
    final String? singleArtistName = track['artist']?.toString();
    final String? singleArtistId = track['artistId']?.toString();

    if (artists != null && artists.isNotEmpty) {
      return artists.map((artist) {
        final name = artist['name']?.toString() ?? 'unknown';
        final id = artist['id']?.toString();
        return ActionChip(
          label: Text(name),
          onPressed: () {
            if (id != null) {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (context) => ArtistDetailsPage(
                    artist: {'id': id, 'name': name, 'coverArt': track['artistCoverArt'] ?? track['coverArt']},
                    apiService: widget.apiService,
                  ),
                ),
              );
            }
          },
          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 0),
          visualDensity: VisualDensity.compact,
          labelStyle: theme.textTheme.titleSmall?.copyWith(
            color: colorScheme.primary,
            fontWeight: FontWeight.bold,
          ),
          side: BorderSide(color: colorScheme.primary.withValues(alpha: 0.2)),
          backgroundColor: colorScheme.primaryContainer.withValues(alpha: 0.3),
        );
      }).toList();
    }

    return [
      ActionChip(
        label: Text(singleArtistName ?? 'unknown artist'),
        onPressed: () {
          if (singleArtistId != null) {
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (context) => ArtistDetailsPage(
                  artist: {'id': singleArtistId, 'name': singleArtistName, 'coverArt': track['artistCoverArt'] ?? track['coverArt']},
                  apiService: widget.apiService,
                ),
              ),
            );
          }
        },
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 0),
        visualDensity: VisualDensity.compact,
        labelStyle: theme.textTheme.titleSmall?.copyWith(
          color: colorScheme.primary,
          fontWeight: FontWeight.bold,
        ),
        side: BorderSide(color: colorScheme.primary.withValues(alpha: 0.2)),
        backgroundColor: colorScheme.primaryContainer.withValues(alpha: 0.3),
      )
    ];
  }
}

class _LyricsView extends StatefulWidget {
  final Map<String, dynamic> track;
  final LyricsService lyricsService;
  final PlayerService playerService;

  const _LyricsView({
    super.key,
    required this.track,
    required this.lyricsService,
    required this.playerService,
  });

  @override
  State<_LyricsView> createState() => _LyricsViewState();
}

class _LyricsViewState extends State<_LyricsView> {
  LyricsData? _lyricsData;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadLyrics();
  }

  Future<void> _loadLyrics() async {
    try {
      final lyrics = await widget.lyricsService.getLyrics(widget.track);
      if (mounted) setState(() { _lyricsData = lyrics; _loading = false; });
    } catch (e) {
      if (mounted) setState(() { _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_lyricsData == null || (_lyricsData!.plain == null && !_lyricsData!.hasSynced)) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Text(
            "no lyrics available".toLowerCase(),
            style: const TextStyle(color: Colors.white70, fontSize: 16),
            textAlign: TextAlign.center,
          ),
        ),
      );
    }

    if (_lyricsData!.hasSynced) {
      return _SyncedLyricsView(
        syncedLyrics: _lyricsData!.synced!,
        playerService: widget.playerService,
      );
    }

    final String lyricsText = _lyricsData!.plain ?? '';

    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 16),
      physics: const BouncingScrollPhysics(),
      child: Center(
        child: Text(
          lyricsText, // KEEP original casing as requested by user!
          textAlign: TextAlign.center,
          style: const TextStyle(
            fontSize: 16,
            height: 1.5,
            color: Colors.white,
          ),
        ),
      ),
    );
  }
}

class _SyncedLyricsView extends StatefulWidget {
  final List<LyricLine> syncedLyrics;
  final PlayerService playerService;

  const _SyncedLyricsView({
    required this.syncedLyrics,
    required this.playerService,
  });

  @override
  State<_SyncedLyricsView> createState() => _SyncedLyricsViewState();
}

class _SyncedLyricsViewState extends State<_SyncedLyricsView> {
  late final List<GlobalKey> _keys;
  late final ScrollController _scrollController;
  int _lastActiveIndex = -1;
  bool _isUserInteracting = false;
  Timer? _interactionTimer;
  late final StreamSubscription<Duration> _positionSubscription;
  int _currentActiveIndex = -1;

  @override
  void initState() {
    super.initState();
    _keys = List.generate(widget.syncedLyrics.length, (index) => GlobalKey());
    _scrollController = ScrollController();
    
    // Listen to position changes
    _positionSubscription = widget.playerService.player.positionStream.listen((position) {
      if (!mounted) return;
      int activeIndex = -1;
      for (int i = 0; i < widget.syncedLyrics.length; i++) {
        if (position >= widget.syncedLyrics[i].time) {
          activeIndex = i;
        } else {
          break;
        }
      }
      
      if (activeIndex != _currentActiveIndex) {
        setState(() {
          _currentActiveIndex = activeIndex;
        });
        
        if (activeIndex != _lastActiveIndex) {
          _lastActiveIndex = activeIndex;
          _scrollToActiveIndex();
        }
      }
    });
  }

  @override
  void dispose() {
    _positionSubscription.cancel();
    _scrollController.dispose();
    _interactionTimer?.cancel();
    super.dispose();
  }

  void _scrollToActiveIndex() {
    if (_isUserInteracting || _currentActiveIndex == -1) return;
    
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final context = _keys[_currentActiveIndex].currentContext;
      if (context != null) {
        Scrollable.ensureVisible(
          context,
          duration: const Duration(milliseconds: 400),
          curve: Curves.easeInOutCubic,
          alignment: 0.4,
        );
      }
    });
  }

  void _resetUserInteractionTimer() {
    _interactionTimer?.cancel();
    _interactionTimer = Timer(const Duration(seconds: 4), () {
      if (mounted) {
        setState(() {
          _isUserInteracting = false;
        });
        _scrollToActiveIndex();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final height = constraints.maxHeight;
        final verticalPadding = height * 0.35;

        return Stack(
          children: [
            NotificationListener<ScrollNotification>(
              onNotification: (notification) {
                if (notification is ScrollStartNotification) {
                  if (notification.dragDetails != null) {
                    setState(() {
                      _isUserInteracting = true;
                    });
                    _interactionTimer?.cancel();
                  }
                } else if (notification is ScrollEndNotification) {
                  if (_isUserInteracting) {
                    _resetUserInteractionTimer();
                  }
                }
                return false;
              },
              child: ListView.builder(
                controller: _scrollController,
                physics: const BouncingScrollPhysics(),
                padding: EdgeInsets.symmetric(vertical: verticalPadding, horizontal: 24),
                itemCount: widget.syncedLyrics.length,
                itemBuilder: (context, index) {
                  final line = widget.syncedLyrics[index];
                  final isActive = index == _currentActiveIndex;
                  final isPast = index < _currentActiveIndex;

                  final textStyle = isActive
                      ? const TextStyle(
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                          fontSize: 20,
                        )
                      : TextStyle(
                          color: isPast
                              ? Colors.white.withValues(alpha: 0.4)
                              : Colors.white.withValues(alpha: 0.7),
                          fontSize: 16,
                        );

                  return KeyedSubtree(
                    key: _keys[index],
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 6),
                      child: InkWell(
                        onTap: () {
                          widget.playerService.seek(line.time);
                          setState(() {
                            _isUserInteracting = false;
                            _currentActiveIndex = index;
                          });
                          _scrollToActiveIndex();
                        },
                        borderRadius: BorderRadius.circular(12),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 12),
                          child: Text(
                            line.text, // KEEP original casing as requested by user!
                            textAlign: TextAlign.center,
                            style: textStyle,
                          ),
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
            if (_isUserInteracting)
              Positioned(
                bottom: 12,
                left: 0,
                right: 0,
                child: Center(
                  child: AnimatedOpacity(
                    opacity: _isUserInteracting ? 1.0 : 0.0,
                    duration: const Duration(milliseconds: 200),
                    child: ActionChip(
                      avatar: const Icon(
                        Icons.sync_rounded,
                        size: 16,
                        color: Colors.white,
                      ),
                      label: Text(
                        'sync to current time'.toLowerCase(),
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      backgroundColor: Colors.white.withValues(alpha: 0.2),
                      side: BorderSide.none,
                      onPressed: () {
                        setState(() {
                          _isUserInteracting = false;
                        });
                        _scrollToActiveIndex();
                      },
                    ),
                  ),
                ),
              ),
          ],
        );
      },
    );
  }
}


