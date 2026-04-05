import 'package:flutter/material.dart';
import 'package:just_audio/just_audio.dart';
import 'package:navidrome_client/services/player_service.dart';
import 'package:navidrome_client/services/api_service.dart';
import 'package:navidrome_client/components/offline_indicator.dart';

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
                if (track == null) return const Center(child: Text("no track playing"));

                final title = (track['title'] ?? 'unknown title').toString();
                final artist = (track['artist'] ?? 'unknown artist').toString();
                final album = (track['album'] ?? 'unknown album').toString();
                final coverArtId = track['coverArt'];
                final coverArtUrl = coverArtId != null
                    ? widget.apiService.getCoverArtUrl(coverArtId, size: 800)
                    : null;

                return Center(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 16.0),
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 500),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
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
                                child: coverArtUrl != null
                                    ? Image.network(
                                        coverArtUrl,
                                        fit: BoxFit.cover,
                                      )
                                    : Container(
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
                          const SizedBox(height: 48),

                          // Title & Artist
                          Column(
                            children: [
                              Text(
                                title,
                                textAlign: TextAlign.center,
                                style: theme.textTheme.headlineMedium?.copyWith(
                                  fontWeight: FontWeight.bold,
                                  color: colorScheme.onSurface,
                                ),
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                              ),
                              const SizedBox(height: 8),
                              Text(
                                artist,
                                textAlign: TextAlign.center,
                                style: theme.textTheme.titleLarge?.copyWith(
                                  color: colorScheme.primary,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                              const SizedBox(height: 4),
                              Text(
                                album,
                                textAlign: TextAlign.center,
                                style: theme.textTheme.bodyMedium?.copyWith(
                                  color: colorScheme.onSurfaceVariant,
                                  letterSpacing: 0.5,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ],
                          ),
                          const SizedBox(height: 48),

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
                                      trackHeight: 8,
                                      thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 6),
                                      overlayShape: const RoundSliderOverlayShape(overlayRadius: 16),
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
                                  const SizedBox(height: 8),
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
                          const SizedBox(height: 32),

                          // Controls
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                            children: [
                              IconButton(
                                icon: const Icon(Icons.shuffle_rounded),
                                onPressed: () {},
                                color: colorScheme.onSurfaceVariant,
                              ),
                              IconButton.filledTonal(
                                iconSize: 32,
                                icon: const Icon(Icons.skip_previous_rounded),
                                onPressed: () => _playerService.skipToPrevious(),
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
                                onPressed: () => _playerService.skipToNext(),
                              ),
                              IconButton(
                                icon: const Icon(Icons.repeat_rounded),
                                onPressed: () {},
                                color: colorScheme.onSurfaceVariant,
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  String _formatDuration(Duration d) {
    if (d == Duration.zero) return "0:00";
    final minutes = d.inMinutes;
    final seconds = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    return "$minutes:$seconds";
  }
}
