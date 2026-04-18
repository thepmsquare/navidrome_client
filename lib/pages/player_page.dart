import 'package:flutter/material.dart';
import 'package:just_audio/just_audio.dart';
import 'package:navidrome_client/services/player_service.dart';
import 'package:navidrome_client/services/api_service.dart';
import 'package:navidrome_client/components/offline_indicator.dart';
import 'package:navidrome_client/pages/queue_page.dart';

class PlayerPage extends StatefulWidget {
  final ApiService apiService;

  const PlayerPage({
    super.key,
    required this.apiService,
  });

  @override
  State<PlayerPage> createState() => _PlayerPageState();
}

class _PlayerPageState extends State<PlayerPage> {
  final PlayerService _playerService = PlayerService();
  bool _hasTriggeredSwipe = false;

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
        actions: [
          IconButton(
            icon: const Icon(Icons.queue_music_rounded),
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (context) => QueuePage(apiService: widget.apiService),
                ),
              );
            },
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: Column(
        children: [
          const OfflineIndicator(),
          Expanded(
            child: StreamBuilder<int?>(
              stream: _playerService.currentIndexStream,
              builder: (context, snapshot) {
                final track = _playerService.currentTrack;
                if (track == null) return const Center(child: Text("no track playing"));

                final title = (track['title'] ?? 'unknown title').toString();
                final artist = (track['artist'] ?? 'unknown artist').toString();
                final album = (track['album'] ?? 'unknown album').toString();
                final coverArtId = track['coverArt'];
                final coverArtUrl = coverArtId != null
                    ? widget.apiService.getCoverArtUrl(coverArtId, size: 800)
                    : null;

                return LayoutBuilder(
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
                          constraints: const BoxConstraints(maxWidth: 500),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              if (!isVeryShort) const Spacer(flex: 2),
                              
                              // Cover Art + metadata swipe zone (gestures do NOT cover progress/controls)
                              GestureDetector(
                                behavior: HitTestBehavior.translucent,
                                onVerticalDragUpdate: (details) {
                                  if (!_hasTriggeredSwipe && details.primaryDelta! > 10) {
                                    setState(() => _hasTriggeredSwipe = true);
                                    Navigator.pop(context);
                                  }
                                },
                                onVerticalDragEnd: (_) => setState(() => _hasTriggeredSwipe = false),
                                onVerticalDragCancel: () => setState(() => _hasTriggeredSwipe = false),
                                onHorizontalDragUpdate: (details) {
                                  if (!_hasTriggeredSwipe) {
                                    if (details.primaryDelta! > 10) {
                                      setState(() => _hasTriggeredSwipe = true);
                                      _playerService.skipToPrevious();
                                    } else if (details.primaryDelta! < -10) {
                                      setState(() => _hasTriggeredSwipe = true);
                                      _playerService.skipToNext();
                                    }
                                  }
                                },
                                onHorizontalDragEnd: (_) => setState(() => _hasTriggeredSwipe = false),
                                onHorizontalDragCancel: () => setState(() => _hasTriggeredSwipe = false),
                                child: Column(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    // Cover Art
                                    AspectRatio(
                                      aspectRatio: 1,
                                      child: Container(
                                        decoration: BoxDecoration(
                                          borderRadius: BorderRadius.circular(32),
                                          boxShadow: [
                                            BoxShadow(
                                              color: colorScheme.shadow.withValues(alpha: 0.15),
                                              blurRadius: 40,
                                              offset: const Offset(0, 10),
                                            ),
                                          ],
                                        ),
                                        child: ClipRRect(
                                          borderRadius: BorderRadius.circular(32),
                                          child: AnimatedSwitcher(
                                            duration: const Duration(milliseconds: 300),
                                            child: coverArtUrl != null
                                                ? Image.network(
                                                    coverArtUrl,
                                                    key: ValueKey(coverArtUrl),
                                                    fit: BoxFit.cover,
                                                  )
                                                : Container(
                                                    key: const ValueKey('placeholder'),
                                                    color: colorScheme.surfaceContainerHighest,
                                                    child: Icon(
                                                      Icons.music_note_rounded,
                                                      size: isShort ? 60 : 100,
                                                      color: colorScheme.primary.withValues(alpha: 0.5),
                                                    ),
                                                  ),
                                          ),
                                        ),
                                      ),
                                    ),

                                    SizedBox(height: isVeryShort ? 12 : isShort ? 16 : 24),

                                    // Title & Artist
                                    Column(
                                      children: [
                                        AnimatedSwitcher(
                                          duration: const Duration(milliseconds: 300),
                                          child: Text(
                                            title,
                                            key: ValueKey('title_$title'),
                                            textAlign: TextAlign.center,
                                            style: (isShort ? theme.textTheme.titleLarge : theme.textTheme.headlineMedium)?.copyWith(
                                              fontWeight: FontWeight.bold,
                                              color: colorScheme.onSurface,
                                            ),
                                            maxLines: 2,
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                        ),
                                        const SizedBox(height: 8),
                                        AnimatedSwitcher(
                                          duration: const Duration(milliseconds: 300),
                                          child: Text(
                                            artist,
                                            key: ValueKey('artist_$artist'),
                                            textAlign: TextAlign.center,
                                            style: (isShort ? theme.textTheme.titleMedium : theme.textTheme.titleLarge)?.copyWith(
                                              color: colorScheme.primary,
                                            ),
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                        ),
                                        if (!isVeryShort) ...[
                                          const SizedBox(height: 4),
                                          AnimatedSwitcher(
                                            duration: const Duration(milliseconds: 300),
                                            child: Text(
                                              album.toLowerCase(),
                                              key: ValueKey('album_$album'),
                                              textAlign: TextAlign.center,
                                              style: theme.textTheme.bodyMedium?.copyWith(
                                                color: colorScheme.onSurfaceVariant,
                                                letterSpacing: 0.5,
                                              ),
                                              maxLines: 1,
                                              overflow: TextOverflow.ellipsis,
                                            ),
                                          ),
                                        ],
                                      ],
                                    ),
                                    const SizedBox(height: 16),
                                    _buildRatingWidget(track, colorScheme),
                                  ],
                                ),
                              ),

                              SizedBox(height: isVeryShort ? 12 : isShort ? 16 : 24),

                              // Progress Bar
                              StreamBuilder<Duration>(
                                stream: _playerService.player.positionStream,
                                builder: (context, snapshot) {
                                  final position = snapshot.data ?? Duration.zero;
                                  final total = _playerService.player.duration ?? Duration.zero;

                                  return Column(
                                    children: [
                                      SliderTheme(
                                        data: SliderTheme.of(context).copyWith(
                                          trackHeight: isShort ? 4 : 8,
                                          thumbShape: RoundSliderThumbShape(enabledThumbRadius: isShort ? 4 : 6),
                                          overlayShape: RoundSliderOverlayShape(overlayRadius: isShort ? 12 : 16),
                                          activeTrackColor: colorScheme.primary,
                                          inactiveTrackColor: colorScheme.surfaceContainerHighest,
                                          thumbColor: colorScheme.primary,
                                        ),
                                        child: Slider(
                                          value: position.inSeconds.toDouble(),
                                          min: 0,
                                          max: total.inSeconds.toDouble().clamp(0.01, double.infinity),
                                          onChanged: (value) {
                                            _playerService.seek(Duration(seconds: value.toInt()));
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

                              if (isVeryShort) const SizedBox(height: 16)
                              else Spacer(flex: isShort ? 2 : 4),

                              // Controls
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
                                        iconSize: isShort ? 20 : 24,
                                        tooltip: 'shuffle',
                                      );
                                    },
                                  ),
                                  IconButton.filledTonal(
                                    iconSize: isShort ? 28 : 32,
                                    icon: const Icon(Icons.skip_previous_rounded),
                                    onPressed: () => _playerService.skipToPrevious(),
                                  ),
                                  StreamBuilder<PlayerState>(
                                    stream: _playerService.player.playerStateStream,
                                    builder: (context, snapshot) {
                                      final playing = snapshot.data?.playing ?? false;
                                      return IconButton.filled(
                                        iconSize: isShort ? 40 : 56,
                                        padding: EdgeInsets.all(isShort ? 12 : 16),
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
                                    iconSize: isShort ? 28 : 32,
                                    icon: const Icon(Icons.skip_next_rounded),
                                    onPressed: () => _playerService.skipToNext(),
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
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRatingWidget(Map<String, dynamic> track, ColorScheme colorScheme) {
    final int userRating = (track['userRating'] as num?)?.toInt() ?? 0;
    final String trackId = track['id']?.toString() ?? '';
    final bool isStarred = track['starred'] != null;

    return Stack(
      alignment: Alignment.center,
      children: [
        // Centered Stars
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
                
                setState(() {
                  track['userRating'] = newRating;
                });
                
                _playerService.updateTrackRating(trackId, newRating);
                widget.apiService.setRating(trackId, newRating);
              },
            );
          }),
        ),
        
        // Right-aligned Favorite Toggle
        Positioned(
          right: 0,
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
      ],
    );
  }

  String _formatDuration(Duration d) {
    if (d == Duration.zero) return "0:00";
    final minutes = d.inMinutes;
    final seconds = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    return "$minutes:$seconds";
  }
}
