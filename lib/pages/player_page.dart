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

class PlayerPage extends StatefulWidget {
  final ApiService apiService;

  const PlayerPage({super.key, required this.apiService});

  @override
  State<PlayerPage> createState() => _PlayerPageState();
}

class _PlayerPageState extends State<PlayerPage> {
  final PlayerService _playerService = PlayerService();
  late final LyricsService _lyricsService;
  late final PageController _pageController;
  late final StreamSubscription<int?> _currentIndexSubscription;
  bool _showLyrics = false;
  // local drag position shown while the user is scrubbing the seek bar;
  // null means we display the live stream position
  double? _dragValue;

  @override
  void initState() {
    super.initState();
    _lyricsService = LyricsService(widget.apiService);

    final initialPage = _playerService.player.currentIndex ?? 0;
    _pageController = PageController(initialPage: initialPage);

    _currentIndexSubscription = _playerService.currentIndexStream.listen((
      index,
    ) {
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

    return Scaffold(
      backgroundColor: colorScheme.surface,
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.expand_more_rounded),
          onPressed: () => Navigator.pop(context),
        ),
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: Column(
        children: [
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
                      : LayoutBuilder(
                          key: const ValueKey('player'),
                          builder: (context, constraints) {
                            final isShort = constraints.maxHeight < 680;
                            final isVeryShort = constraints.maxHeight < 550;

                            return Center(
                              child: Padding(
                                padding: EdgeInsets.symmetric(
                                  horizontal: 24.0,
                                  vertical: isVeryShort ? 8.0 : 16.0,
                                ),
                                child: ConstrainedBox(
                                  constraints: const BoxConstraints(
                                    maxWidth: 500,
                                  ),
                                  child: Column(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      if (!isVeryShort) const Spacer(flex: 1),
                                      Expanded(
                                        flex: 20,
                                        child: PageView.builder(
                                          controller: _pageController,
                                          padEnds: false,
                                          onPageChanged: (index) {
                                            _playerService
                                                .seekToIndex(index)
                                                .catchError((_) {});
                                          },
                                          itemCount: _playerService
                                              .currentQueue
                                              .length,
                                          itemBuilder: (context, index) {
                                            final itemTrack = _playerService
                                                .currentQueue[index];
                                            final itemCoverArtId =
                                                itemTrack['coverArt'];
                                            final itemCoverArtUrl =
                                                itemCoverArtId != null
                                                ? widget.apiService
                                                      .getCoverArtUrl(
                                                        itemCoverArtId,
                                                        size: 800,
                                                      )
                                                : null;

                                            return Padding(
                                              padding:
                                                  const EdgeInsets.symmetric(
                                                    horizontal: 4.0,
                                                  ),
                                              child: Column(
                                                mainAxisAlignment:
                                                    MainAxisAlignment.center,
                                                children: [
                                                  Flexible(
                                                    child: AspectRatio(
                                                      aspectRatio: 1,
                                                      child: Container(
                                                        decoration: BoxDecoration(
                                                          borderRadius:
                                                              BorderRadius.circular(
                                                                40,
                                                              ),
                                                          boxShadow: [
                                                            BoxShadow(
                                                              color: colorScheme
                                                                  .shadow
                                                                  .withValues(
                                                                    alpha: 0.25,
                                                                  ),
                                                              blurRadius: 50,
                                                              offset:
                                                                  const Offset(
                                                                    0,
                                                                    15,
                                                                  ),
                                                              spreadRadius: -5,
                                                            ),
                                                          ],
                                                        ),
                                                        child: ClipRRect(
                                                          borderRadius:
                                                              BorderRadius.circular(
                                                                10,
                                                              ),
                                                          child: OfflineImage(
                                                            coverArtId: itemCoverArtId?.toString(),
                                                            remoteUrl: itemCoverArtUrl,
                                                            fit: BoxFit.cover,
                                                            placeholder: Container(
                                                              color: colorScheme
                                                                  .surfaceContainerHighest,
                                                              child: Icon(
                                                                Icons
                                                                    .music_note_rounded,
                                                                size:
                                                                    isShort
                                                                    ? 60
                                                                    : 100,
                                                                color: colorScheme
                                                                    .primary
                                                                    .withValues(
                                                                      alpha:
                                                                          0.5,
                                                                    ),
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
                                      SizedBox(
                                        height: isVeryShort
                                            ? 8
                                            : isShort
                                            ? 12
                                            : 16,
                                      ),
                                      AnimatedSwitcher(
                                        duration: const Duration(
                                          milliseconds: 300,
                                        ),
                                        child: Column(
                                          key: ValueKey(
                                            'metadata_${track['id']}',
                                          ),
                                          children: [
                                            Text(
                                              (track['title'] ??
                                                      'unknown title')
                                                  .toString(),
                                              textAlign: TextAlign.center,
                                              style:
                                                  (isShort
                                                          ? theme
                                                                .textTheme
                                                                .titleLarge
                                                          : theme
                                                                .textTheme
                                                                .headlineMedium)
                                                      ?.copyWith(
                                                        fontWeight:
                                                            FontWeight.bold,
                                                        color: colorScheme
                                                            .onSurface,
                                                      ),
                                              maxLines: 2,
                                              overflow: TextOverflow.ellipsis,
                                            ),
                                            const SizedBox(height: 6),
                                            Wrap(
                                              alignment: WrapAlignment.center,
                                              spacing: 4,
                                              runSpacing: 4,
                                              children: _buildArtistWidgets(track, context, theme, colorScheme, isShort),
                                            ),
                                            if (!isVeryShort) ...[
                                              const SizedBox(height: 2),
                                              GestureDetector(
                                                onTap: () {
                                                  final albumId =
                                                      track['albumId']
                                                          ?.toString();
                                                  if (albumId != null) {
                                                    Navigator.push(
                                                      context,
                                                      MaterialPageRoute(
                                                        builder: (context) => AlbumDetailsPage(
                                                          album: {
                                                            'id': albumId,
                                                            'name':
                                                                (track['album'] ??
                                                                        'unknown album')
                                                                    .toString(),
                                                            'coverArt':
                                                                track['coverArt'],
                                                          },
                                                          apiService:
                                                              widget.apiService,
                                                        ),
                                                      ),
                                                    );
                                                  }
                                                },
                                                child: Text(
                                                  (track['album'] ??
                                                          'unknown album')
                                                      .toString(),
                                                  textAlign: TextAlign.center,
                                                  style: theme
                                                      .textTheme
                                                      .bodyMedium
                                                      ?.copyWith(
                                                        color: colorScheme
                                                            .onSurfaceVariant,
                                                        letterSpacing: 0.5,
                                                      ),
                                                  maxLines: 1,
                                                  overflow:
                                                      TextOverflow.ellipsis,
                                                ),
                                              ),
                                            ],
                                            const SizedBox(height: 12),
                                            _buildRatingWidget(
                                              track,
                                              colorScheme,
                                            ),
                                          ],
                                        ),
                                      ),
                                      SizedBox(
                                        height: isVeryShort
                                            ? 8
                                            : isShort
                                            ? 12
                                            : 16,
                                      ),
                                      StreamBuilder<Duration>(
                                        stream: _playerService
                                            .player
                                            .positionStream,
                                        builder: (context, snapshot) {
                                          final position =
                                              snapshot.data ?? Duration.zero;
                                          final total =
                                              _playerService.player.duration ??
                                              Duration.zero;

                                          return Column(
                                            children: [
                                              SliderTheme(
                                                data: SliderTheme.of(context).copyWith(
                                                  trackHeight: isShort ? 4 : 8,
                                                  thumbShape:
                                                      RoundSliderThumbShape(
                                                        enabledThumbRadius:
                                                            isShort ? 4 : 6,
                                                      ),
                                                  overlayShape:
                                                      RoundSliderOverlayShape(
                                                        overlayRadius: isShort
                                                            ? 12
                                                            : 16,
                                                      ),
                                                  activeTrackColor:
                                                      colorScheme.primary,
                                                  inactiveTrackColor: colorScheme
                                                      .surfaceContainerHighest,
                                                  thumbColor:
                                                      colorScheme.primary,
                                                ),
                                                child: Slider(
                                                  value:
                                                      (_dragValue ??
                                                              position.inSeconds
                                                                  .toDouble())
                                                          .clamp(
                                                            0.0,
                                                            total.inSeconds
                                                                .toDouble()
                                                                .clamp(
                                                                  0.01,
                                                                  double
                                                                      .infinity,
                                                                ),
                                                          ),
                                                  min: 0,
                                                  max: total.inSeconds
                                                      .toDouble()
                                                      .clamp(
                                                        0.01,
                                                        double.infinity,
                                                      ),
                                                  onChangeStart: (_) =>
                                                      setState(
                                                        () => _dragValue =
                                                            position.inSeconds
                                                                .toDouble(),
                                                      ),
                                                  onChanged: (value) =>
                                                      setState(
                                                        () =>
                                                            _dragValue = value,
                                                      ),
                                                  onChangeEnd: (value) {
                                                    _playerService.seek(
                                                      Duration(
                                                        seconds: value.toInt(),
                                                      ),
                                                    );
                                                    setState(
                                                      () => _dragValue = null,
                                                    );
                                                  },
                                                ),
                                              ),
                                              const SizedBox(height: 4),
                                              Padding(
                                                padding:
                                                    const EdgeInsets.symmetric(
                                                      horizontal: 4.0,
                                                    ),
                                                child: Row(
                                                  mainAxisAlignment:
                                                      MainAxisAlignment
                                                          .spaceBetween,
                                                  children: [
                                                    Text(
                                                      _formatDuration(position),
                                                      style: theme
                                                          .textTheme
                                                          .labelMedium
                                                          ?.copyWith(
                                                            color: colorScheme
                                                                .onSurfaceVariant,
                                                            fontFeatures: const [
                                                              FontFeature.tabularFigures(),
                                                            ],
                                                          ),
                                                    ),
                                                    Text(
                                                      _formatDuration(total),
                                                      style: theme
                                                          .textTheme
                                                          .labelMedium
                                                          ?.copyWith(
                                                            color: colorScheme
                                                                .onSurfaceVariant,
                                                            fontFeatures: const [
                                                              FontFeature.tabularFigures(),
                                                            ],
                                                          ),
                                                    ),
                                                  ],
                                                ),
                                              ),
                                            ],
                                          );
                                        },
                                      ),
                                      if (isVeryShort)
                                        const SizedBox(height: 16)
                                      else
                                        Spacer(flex: isShort ? 2 : 4),
                                      Row(
                                        mainAxisAlignment:
                                            MainAxisAlignment.spaceEvenly,
                                        children: [
                                          StreamBuilder<bool>(
                                            stream: _playerService
                                                .player
                                                .shuffleModeEnabledStream,
                                            builder: (context, snapshot) {
                                              final enabled =
                                                  snapshot.data ?? false;
                                              return IconButton(
                                                icon: const Icon(
                                                  Icons.shuffle_rounded,
                                                ),
                                                onPressed: () => _playerService
                                                    .toggleShuffleMode(),
                                                color: enabled
                                                    ? colorScheme.primary
                                                    : colorScheme
                                                          .onSurfaceVariant,
                                                iconSize: isShort ? 20 : 24,
                                                tooltip: 'shuffle',
                                              );
                                            },
                                          ),
                                          IconButton.filledTonal(
                                            iconSize: isShort ? 28 : 32,
                                            icon: const Icon(
                                              Icons.skip_previous_rounded,
                                            ),
                                            onPressed: () => _playerService
                                                .skipToPrevious()
                                                .catchError((_) {}),
                                          ),
                                          StreamBuilder<PlayerState>(
                                            stream: _playerService
                                                .player
                                                .playerStateStream,
                                            builder: (context, snapshot) {
                                              final playing =
                                                  snapshot.data?.playing ??
                                                  false;
                                              return IconButton.filled(
                                                iconSize: isShort ? 40 : 56,
                                                padding: EdgeInsets.all(
                                                  isShort ? 12 : 16,
                                                ),
                                                icon: Icon(
                                                  playing
                                                      ? Icons.pause_rounded
                                                      : Icons
                                                            .play_arrow_rounded,
                                                ),
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
                                            iconSize: isShort ? 28 : 32,
                                            icon: const Icon(
                                              Icons.skip_next_rounded,
                                            ),
                                            onPressed: () => _playerService
                                                .skipToNext()
                                                .catchError((_) {}),
                                          ),
                                          StreamBuilder<LoopMode>(
                                            stream: _playerService
                                                .player
                                                .loopModeStream,
                                            builder: (context, snapshot) {
                                              final mode =
                                                  snapshot.data ?? LoopMode.off;
                                              final isOff =
                                                  mode == LoopMode.off;
                                              final isOne =
                                                  mode == LoopMode.one;

                                              return IconButton(
                                                icon: Icon(
                                                  isOne
                                                      ? Icons.repeat_one_rounded
                                                      : Icons.repeat_rounded,
                                                ),
                                                onPressed: () => _playerService
                                                    .toggleLoopMode(),
                                                color: isOff
                                                    ? colorScheme
                                                          .onSurfaceVariant
                                                    : colorScheme.primary,
                                                iconSize: isShort ? 20 : 24,
                                                tooltip: 'repeat',
                                              );
                                            },
                                          ),
                                        ],
                                      ),
                                      if (!isVeryShort) const Spacer(flex: 3),
                                    ],
                                  ),
                                ),
                              ),
                            );
                          },
                        ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRatingWidget(
    Map<String, dynamic> track,
    ColorScheme colorScheme,
  ) {
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
                color: isSelected
                    ? colorScheme.primary
                    : colorScheme.onSurfaceVariant.withValues(alpha: 0.5),
                size: 28,
              ),
              onPressed: () {
                if (trackId.isEmpty) return;
                final newRating = (starIndex == userRating) ? 0 : starIndex;

                setState(() {
                  track['userRating'] = newRating;
                });

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
              isStarred
                  ? Icons.favorite_rounded
                  : Icons.favorite_border_rounded,
              color: isStarred
                  ? Colors.redAccent
                  : colorScheme.onSurfaceVariant.withValues(alpha: 0.5),
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
                  MaterialPageRoute(
                    builder: (context) =>
                        QueuePage(apiService: widget.apiService),
                  ),
                );
              }
            },
            itemBuilder: (context) => [
              PopupMenuItem(
                value: 'lyrics',
                child: Row(
                  children: [
                    Icon(
                      _showLyrics
                          ? Icons.music_note_rounded
                          : Icons.lyrics_rounded,
                      size: 20,
                    ),
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
                    const SizedBox(width: 12),
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

  List<Widget> _buildArtistWidgets(
    Map<String, dynamic> track,
    BuildContext context,
    ThemeData theme,
    ColorScheme colorScheme,
    bool isShort,
  ) {
    final List<dynamic>? artists = track['artists'];
    final String? singleArtistName = track['artist']?.toString();
    final String? singleArtistId = track['artistId']?.toString();

    if (artists != null && artists.isNotEmpty) {
      final List<Widget> widgets = [];
      for (int i = 0; i < artists.length; i++) {
        final artist = artists[i];
        final name = artist['name']?.toString() ?? 'unknown';
        final id = artist['id']?.toString();

        widgets.add(
          ActionChip(
            label: Text(name),
            onPressed: () {
              if (id != null) {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) => ArtistDetailsPage(
                      artist: {
                        'id': id,
                        'name': name,
                        'coverArt': track['artistCoverArt'] ?? track['coverArt'],
                      },
                      apiService: widget.apiService,
                    ),
                  ),
                );
              }
            },
            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 0),
            visualDensity: VisualDensity.compact,
            labelStyle: (isShort ? theme.textTheme.labelLarge : theme.textTheme.titleSmall)?.copyWith(
              color: colorScheme.primary,
              fontWeight: FontWeight.bold,
            ),
            side: BorderSide(color: colorScheme.primary.withValues(alpha: 0.2)),
            backgroundColor: colorScheme.primaryContainer.withValues(alpha: 0.3),
          ),
        );
      }
      return widgets;
    }

    // Fallback to single artist
    return [
      ActionChip(
        label: Text(singleArtistName ?? 'unknown artist'),
        onPressed: () {
          if (singleArtistId != null) {
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (context) => ArtistDetailsPage(
                  artist: {
                    'id': singleArtistId,
                    'name': singleArtistName,
                    'coverArt': track['artistCoverArt'] ?? track['coverArt'],
                  },
                  apiService: widget.apiService,
                ),
              ),
            );
          }
        },
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 0),
        visualDensity: VisualDensity.compact,
        labelStyle: (isShort ? theme.textTheme.labelLarge : theme.textTheme.titleSmall)?.copyWith(
          color: colorScheme.primary,
          fontWeight: FontWeight.bold,
        ),
        side: BorderSide(color: colorScheme.primary.withValues(alpha: 0.2)),
        backgroundColor: colorScheme.primaryContainer.withValues(alpha: 0.3),
      ),
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
  final ScrollController _scrollController = ScrollController();
  int _currentIndex = -1;

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void _scrollToIndex(int index) {
    if (index < 0 || !_scrollController.hasClients) return;

    // Approximate line height + padding
    const lineHeight = 60.0;
    final offset = index * lineHeight;

    _scrollController.animateTo(
      (offset - 200).clamp(0, _scrollController.position.maxScrollExtent),
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeInOut,
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final title = (widget.track['title'] ?? 'unknown title').toString();
    final artist = (widget.track['artist'] ?? 'unknown artist').toString();

    return FutureBuilder<LyricsData?>(
      future: widget.lyricsService.getLyrics(widget.track),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }

        final lyricsData = snapshot.data;
        if (lyricsData == null ||
            (lyricsData.plain == null && !lyricsData.hasSynced)) {
          return _buildNoLyrics(theme, colorScheme);
        }

        if (lyricsData.hasSynced) {
          return StreamBuilder<Duration>(
            stream: widget.playerService.player.positionStream,
            builder: (context, positionSnapshot) {
              final position = positionSnapshot.data ?? Duration.zero;
              final synced = lyricsData.synced!;

              final index = synced.lastIndexWhere(
                (line) => line.time <= position,
              );
              if (index != _currentIndex && index != -1) {
                _currentIndex = index;
                WidgetsBinding.instance.addPostFrameCallback(
                  (_) => _scrollToIndex(index),
                );
              }

              return ListView.builder(
                controller: _scrollController,
                padding: const EdgeInsets.symmetric(
                  horizontal: 32,
                  vertical: 40,
                ),
                itemCount: synced.length,
                itemBuilder: (context, i) {
                  final isCurrent = i == index;
                  final line = synced[i];

                  return GestureDetector(
                    onTap: () => widget.playerService.seek(line.time),
                    child: AnimatedPadding(
                      duration: const Duration(milliseconds: 200),
                      padding: EdgeInsets.symmetric(
                        vertical: isCurrent ? 12 : 8,
                      ),
                      child: AnimatedDefaultTextStyle(
                        duration: const Duration(milliseconds: 200),
                        style: theme.textTheme.headlineSmall!.copyWith(
                          fontSize: isCurrent ? 24 : 20,
                          fontWeight: isCurrent
                              ? FontWeight.bold
                              : FontWeight.normal,
                          color: isCurrent
                              ? colorScheme.primary
                              : colorScheme.onSurface.withValues(alpha: 0.5),
                        ),
                        child: Text(line.text.toLowerCase()),
                      ),
                    ),
                  );
                },
              );
            },
          );
        }

        // Fallback to plain lyrics
        return SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title.toLowerCase(),
                style: theme.textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.bold,
                  color: colorScheme.onSurface,
                ),
              ),
              Text(
                artist.toLowerCase(),
                style: theme.textTheme.titleMedium?.copyWith(
                  color: colorScheme.primary,
                ),
              ),
              const SizedBox(height: 32),
              Text(
                lyricsData.plain!.toLowerCase(),
                style: theme.textTheme.bodyLarge?.copyWith(
                  height: 1.8,
                  fontSize: 18,
                  color: colorScheme.onSurface.withValues(alpha: 0.9),
                  letterSpacing: 0.2,
                ),
              ),
              const SizedBox(height: 40),
            ],
          ),
        );
      },
    );
  }

  Widget _buildNoLyrics(ThemeData theme, ColorScheme colorScheme) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.sentiment_dissatisfied_rounded,
            size: 64,
            color: colorScheme.onSurfaceVariant.withValues(alpha: 0.3),
          ),
          const SizedBox(height: 16),
          Text(
            'no lyrics found',
            style: theme.textTheme.bodyLarge?.copyWith(
              color: colorScheme.onSurfaceVariant,
            ),
          ),
        ],
      ),
    );
  }
}

