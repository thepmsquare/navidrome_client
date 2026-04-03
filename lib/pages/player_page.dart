import 'package:flutter/material.dart';
import 'package:just_audio/just_audio.dart';
import 'package:navidrome_client/services/player_service.dart';
import 'package:navidrome_client/services/api_service.dart';

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
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.expand_more),
          onPressed: () => Navigator.pop(context),
        ),
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: StreamBuilder<int?>(
        stream: _playerService.currentIndexStream,
        builder: (context, snapshot) {
          final track = _playerService.currentTrack;
          if (track == null) return const Center(child: Text("no track playing"));

          final title = (track['title'] ?? 'unknown title').toString().toLowerCase();
          final artist = (track['artist'] ?? 'unknown artist').toString().toLowerCase();
          final album = (track['album'] ?? 'unknown album').toString().toLowerCase();
          final coverArtId = track['coverArt'];
          final coverArtUrl = coverArtId != null
              ? widget.apiService.getCoverArtUrl(coverArtId, size: 800)
              : null;

          return Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 16.0),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 600),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    // Cover Art
                    ConstrainedBox(
                      constraints: BoxConstraints(
                        maxHeight: MediaQuery.of(context).size.height * 0.4,
                      ),
                      child: Card(
                        elevation: 8,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(16),
                          child: AspectRatio(
                            aspectRatio: 1,
                            child: coverArtUrl != null
                                ? Image.network(
                                    coverArtUrl,
                                    fit: BoxFit.cover,
                                  )
                                : Container(
                                    color: Theme.of(context).colorScheme.surfaceContainerHighest,
                                    child: const Icon(Icons.music_note, size: 100),
                                  ),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 32),

                    // Title & Artist
                    Align(
                      alignment: Alignment.centerLeft,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            title,
                            style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.bold),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          Text(
                            artist,
                            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                                  color: Theme.of(context).colorScheme.outline,
                                ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          Text(
                            album,
                            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                  color: Theme.of(context).colorScheme.outline.withOpacity(0.7),
                                ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),

                    // Progress Bar
                    StreamBuilder<Duration>(
                      stream: _playerService.player.positionStream,
                      builder: (context, snapshot) {
                        final position = snapshot.data ?? Duration.zero;
                        final total = _playerService.player.duration ?? Duration.zero;

                        return Column(
                          children: [
                            Slider(
                              value: position.inSeconds.toDouble(),
                              min: 0,
                              max: total.inSeconds.toDouble().clamp(0.01, double.infinity),
                              onChanged: (value) {
                                _playerService.seek(Duration(seconds: value.toInt()));
                              },
                            ),
                            Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 24.0),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Text(_formatDuration(position)),
                                  Text(_formatDuration(total)),
                                ],
                              ),
                            ),
                          ],
                        );
                      },
                    ),
                    const SizedBox(height: 16),

                    // Controls
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                      children: [
                        IconButton(
                          icon: const Icon(Icons.shuffle),
                          onPressed: () {
                            // shuffle logic can be added later
                          },
                          color: Theme.of(context).colorScheme.outline,
                        ),
                        IconButton(
                          iconSize: 48,
                          icon: const Icon(Icons.skip_previous),
                          onPressed: () => _playerService.skipToPrevious(),
                        ),
                        StreamBuilder<PlayerState>(
                          stream: _playerService.player.playerStateStream,
                          builder: (context, snapshot) {
                            final playing = snapshot.data?.playing ?? false;
                            return IconButton(
                              iconSize: 72,
                              icon: Icon(playing ? Icons.pause_circle_filled : Icons.play_circle_filled),
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
                        IconButton(
                          iconSize: 48,
                          icon: const Icon(Icons.skip_next),
                          onPressed: () => _playerService.skipToNext(),
                        ),
                        IconButton(
                          icon: const Icon(Icons.repeat),
                          onPressed: () {
                            // repeat logic can be added later
                          },
                          color: Theme.of(context).colorScheme.outline,
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
    );
  }

  String _formatDuration(Duration d) {
    String twoDigits(int n) => n.toString().padLeft(2, "0");
    String twoDigitMinutes = twoDigits(d.inMinutes.remainder(60));
    String twoDigitSeconds = twoDigits(d.inSeconds.remainder(60));
    return "${twoDigits(d.inHours)}:$twoDigitMinutes:$twoDigitSeconds";
  }
}
