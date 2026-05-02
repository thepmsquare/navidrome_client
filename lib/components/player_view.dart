import 'dart:async';
import 'package:flutter/material.dart';
import 'package:just_audio/just_audio.dart';
import 'package:navidrome_client/services/player_service.dart';
import 'package:navidrome_client/services/api_service.dart';
import 'package:navidrome_client/components/offline_indicator.dart';
import 'package:navidrome_client/components/offline_image.dart';
import 'package:navidrome_client/pages/queue_page.dart';
import 'package:navidrome_client/services/lyrics_service.dart';
import 'package:navidrome_client/pages/artist_details_page.dart';
import 'package:navidrome_client/pages/album_details_page.dart';

class PlayerView extends StatefulWidget {
  final ApiService apiService;
  final VoidCallback onMinimize;

  const PlayerView({
    super.key,
    required this.apiService,
    required this.onMinimize,
  });

  @override
  State<PlayerView> createState() => _PlayerViewState();
}

class _PlayerViewState extends State<PlayerView> {
  final PlayerService _playerService = PlayerService();
  late final LyricsService _lyricsService;
  late final PageController _pageController;
  late final StreamSubscription<int?> _currentIndexSubscription;
  bool _showLyrics = false;
  double? _dragValue;

  @override
  void initState() {
    super.initState();
    _lyricsService = LyricsService(widget.apiService);

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
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Column(
      children: [
        AppBar(
          leading: IconButton(
            icon: const Icon(Icons.expand_more_rounded),
            onPressed: widget.onMinimize,
          ),
          backgroundColor: Colors.transparent,
          elevation: 0,
        ),
        const OfflineIndicator(),
        Expanded(
          child: StreamBuilder<int?>(
            stream: _playerService.currentIndexStream,
            builder: (context, snapshot) {
              final track = _playerService.currentTrack;
              if (track == null) {
                return const Center(child: Text("no track playing"));
              }

              return AnimatedSwitcher(
                duration: const Duration(milliseconds: 400),
                transitionBuilder: (child, animation) {
                  return FadeTransition(
                    opacity: animation,
                    child: SlideTransition(
                      position: Tween<Offset>(
                        begin: const Offset(0, 0.05),
                        end: Offset.zero,
                      ).animate(animation),
                      child: child,
                    ),
                  );
                },
                child: _showLyrics
                    ? _LyricsView(
                        key: ValueKey('lyrics_${track['id']}'),
                        track: track,
                        lyricsService: _lyricsService,
                        playerService: _playerService,
                      )
                    : Center(
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
                                      _playerService.seekToIndex(index).catchError((_) {});
                                    },
                                    itemCount: _playerService.currentQueue.length,
                                    itemBuilder: (context, index) {
                                      final itemTrack = _playerService.currentQueue[index];
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
                                                    child: OfflineImage(
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
                                      Wrap(
                                        alignment: WrapAlignment.center,
                                        spacing: 4,
                                        runSpacing: 4,
                                        children: _buildArtistWidgets(track, context, theme, colorScheme),
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
                                    final position = snapshot.data ?? Duration.zero;
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
                              ],
                            ),
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
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (context) => QueuePage(apiService: widget.apiService)),
                );
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
            ],
          ),
        ),
      ],
    );
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
      return const Center(child: Text("no lyrics available"));
    }

    final String lyricsText = _lyricsData!.plain ?? 
        _lyricsData!.synced!.map((l) => l.text).join('\n');

    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Text(
        lyricsText,
        textAlign: TextAlign.center,
        style: Theme.of(context).textTheme.bodyLarge?.copyWith(fontSize: 18, height: 1.6),
      ),
    );
  }
}
