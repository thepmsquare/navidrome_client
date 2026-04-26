import 'dart:async';
import 'package:flutter/material.dart';
import 'package:navidrome_client/components/track_list_item.dart';
import 'package:navidrome_client/components/mini_player.dart';
import 'package:navidrome_client/pages/player_page.dart';
import 'package:navidrome_client/pages/artist_details_page.dart';
import 'package:navidrome_client/services/api_service.dart';
import 'package:navidrome_client/services/player_service.dart';
import 'package:navidrome_client/services/offline_service.dart';
import 'package:navidrome_client/components/offline_image.dart';
import 'package:navidrome_client/components/offline_indicator.dart';

class PlaylistDetailsPage extends StatefulWidget {
  final Map<String, dynamic> playlist;
  final ApiService apiService;

  const PlaylistDetailsPage({
    super.key,
    required this.playlist,
    required this.apiService,
  });

  @override
  State<PlaylistDetailsPage> createState() => _PlaylistDetailsPageState();
}

class _PlaylistDetailsPageState extends State<PlaylistDetailsPage> {
  List<Map<String, dynamic>> _tracks = [];
  bool _isLoading = true;

  late final bool _isOfflineMode;
  bool _isPlaylistOffline = false;
  bool _downloadErrorShown = false;

  double _playlistDownloadProgress = 0.0;
  StreamSubscription<OfflineProgress>? _playlistProgressSub;

  @override
  void initState() {
    super.initState();
    final offline = OfflineService();
    _isOfflineMode = offline.isOfflineMode;
    _isPlaylistOffline = offline.isPlaylistOfflineSync(widget.playlist['id'].toString());
    _subscribeToPlaylistProgress();
    OfflineService().addListener(_onOfflineStatusChanged);
    _loadTracks();
  }

  void _onOfflineStatusChanged() {
    if (mounted) setState(() {});
  }

  void _subscribeToPlaylistProgress() {
    final playlistId = widget.playlist['id'].toString();
    _playlistProgressSub = OfflineService().getDownloadProgress(playlistId).listen((p) {
      if (!mounted) return;
      
      if (p.hasError && !_downloadErrorShown) {
        _downloadErrorShown = true;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('some tracks failed to download. please try again.')),
        );
      }

      setState(() {
        _playlistDownloadProgress = p.fraction;
        if (p.isDone) {
          _isPlaylistOffline = OfflineService().isPlaylistOfflineSync(widget.playlist['id'].toString());
        }
      });
    });
  }

  @override
  void dispose() {
    _playlistProgressSub?.cancel();
    OfflineService().removeListener(_onOfflineStatusChanged);
    super.dispose();
  }

  Future<void> _loadTracks() async {
    final offlineService = OfflineService();
    final playlistId = widget.playlist['id'].toString();

    if (_isOfflineMode) {
      final cached = await offlineService.getCachedPlaylistMetadata(playlistId);
      if (cached != null && mounted) {
        setState(() {
          _tracks = cached;
          _isLoading = false;
        });
        return;
      }
    }

    try {
      final tracks = await widget.apiService.getPlaylistTracks(playlistId);
      await offlineService.savePlaylistMetadata(playlistId, tracks);

      if (mounted) {
        setState(() {
          _tracks = tracks;
          _isLoading = false;
        });
      }
    } catch (e) {
      final cached = await offlineService.getCachedPlaylistMetadata(playlistId);
      if (cached != null && mounted) {
        setState(() {
          _tracks = cached;
          _isLoading = false;
        });
      } else if (mounted) {
        setState(() { _isLoading = false; });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('failed to load tracks: ${e.toString()}')),
        );
      }
    }
  }

  List<Map<String, dynamic>> get _tracksToDisplay {
    if (!_isOfflineMode) return _tracks;
    return _tracks
        .where((t) => OfflineService().isTrackOfflineSync(t['id'].toString()))
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    final String name = (widget.playlist['name'] ?? 'unknown playlist').toString();
    final String? coverArtId = widget.playlist['coverArt']?.toString();
    final String? coverArtUrl = coverArtId != null
        ? widget.apiService.getCoverArtUrl(coverArtId, size: 600)
        : null;

    final bool isDownloading = _playlistDownloadProgress > 0 && _playlistDownloadProgress < 1.0;

    return Scaffold(
      body: Column(
        children: [
          const SafeArea(
            bottom: false,
            child: OfflineIndicator(),
          ),
          Expanded(
            child: Stack(
              children: [
                CustomScrollView(
                  slivers: [
                    SliverAppBar(
                      pinned: true,
                      expandedHeight: 300,
                      backgroundColor: colorScheme.surface,
                      flexibleSpace: FlexibleSpaceBar(
                        title: Row(
                          children: [
                            IconButton.filled(
                              icon: const Icon(Icons.play_arrow_rounded, size: 24),
                              onPressed: _isLoading || _tracksToDisplay.isEmpty
                                  ? null
                                  : () => PlayerService().play(_tracksToDisplay, 0, widget.apiService),
                              style: IconButton.styleFrom(
                                backgroundColor: colorScheme.primary,
                                foregroundColor: colorScheme.onPrimary,
                                padding: const EdgeInsets.all(8),
                                elevation: 4,
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: SingleChildScrollView(
                                scrollDirection: Axis.horizontal,
                                child: Text(
                                  name,
                                  style: theme.textTheme.headlineSmall?.copyWith(
                                    color: Colors.white,
                                    fontWeight: FontWeight.bold,
                                    shadows: const [
                                      Shadow(blurRadius: 12, color: Colors.black54, offset: Offset(0, 2)),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            IconButton.filledTonal(
                              icon: isDownloading
                                  ? SizedBox(
                                      width: 18,
                                      height: 18,
                                      child: CircularProgressIndicator(
                                        value: _playlistDownloadProgress,
                                        strokeWidth: 2,
                                        color: colorScheme.onSecondaryContainer,
                                      ),
                                    )
                                  : _isPlaylistOffline
                                      ? const Icon(Icons.download_done_rounded, size: 20)
                                      : const Icon(Icons.download_for_offline_rounded, size: 20),
                              onPressed: isDownloading || (_isPlaylistOffline && !_isOfflineMode) || (_tracks.isEmpty && !_isOfflineMode)
                                  ? null
                                  : () {
                                      if (_isPlaylistOffline) {
                                        _showDeletePlaylistConfirmation(context);
                                      } else {
                                        _downloadErrorShown = false;
                                        OfflineService().downloadPlaylist(
                                          widget.playlist['id'].toString(),
                                          _tracks,
                                          widget.apiService,
                                        );
                                      }
                                    },
                              style: IconButton.styleFrom(
                                backgroundColor: Colors.white.withValues(alpha: 0.2),
                                foregroundColor: Colors.white,
                              ),
                            ),
                          ],
                        ),
                        titlePadding: const EdgeInsets.only(left: 56, bottom: 16, right: 16),
                        background: Stack(
                          fit: StackFit.expand,
                          children: [
                            OfflineImage(
                              coverArtId: coverArtId,
                              remoteUrl: coverArtUrl,
                              fit: BoxFit.cover,
                              placeholder: Container(color: colorScheme.surfaceContainerHighest),
                            ),
                            DecoratedBox(
                              decoration: BoxDecoration(
                                gradient: LinearGradient(
                                  begin: Alignment.topCenter,
                                  end: Alignment.bottomCenter,
                                  colors: [
                                    Colors.transparent,
                                    Colors.black.withValues(alpha: 0.6),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    if (_isLoading)
                      const SliverFillRemaining(
                        child: Center(child: CircularProgressIndicator()),
                      )
                    else if (_tracksToDisplay.isEmpty)
                      const SliverFillRemaining(
                        child: Center(child: Text('no tracks in this playlist')),
                      )
                    else
                      SliverPadding(
                        padding: const EdgeInsets.only(top: 8, bottom: 100),
                        sliver: SliverList(
                          delegate: SliverChildBuilderDelegate(
                            (context, index) {
                              final tracks = _tracksToDisplay;
                              if (index >= tracks.length) return null;
                              final track = tracks[index];
                              final trackCoverArtId = track['coverArt'] ?? widget.playlist['coverArt'];
                              final trackCoverArtUrl = trackCoverArtId != null
                                  ? widget.apiService.getCoverArtUrl(trackCoverArtId)
                                  : null;
                              return TrackListItem(
                                track: track,
                                coverArtUrl: trackCoverArtUrl,
                                apiService: widget.apiService,
                                onTap: () {
                                  PlayerService().play(tracks, index, widget.apiService);
                                },
                                onArtistTap: (artist) {
                                  Navigator.push(
                                    context,
                                    MaterialPageRoute(
                                      builder: (context) => ArtistDetailsPage(
                                        artist: {
                                          ...artist,
                                          'coverArt': artist['coverArt'] ?? track['artistCoverArt'] ?? track['coverArt'],
                                        },
                                        apiService: widget.apiService,
                                      ),
                                    ),
                                  );
                                },
                              );
                            },
                            childCount: _tracksToDisplay.length,
                          ),
                        ),
                      ),
                  ],
                ),
                Positioned(
                  left: 0,
                  right: 0,
                  bottom: 0,
                  child: MiniPlayer(
                    apiService: widget.apiService,
                    onTap: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (context) => PlayerPage(apiService: widget.apiService),
                          fullscreenDialog: true,
                        ),
                      );
                    },
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _showDeletePlaylistConfirmation(BuildContext context) async {
    final name = (widget.playlist['name'] ?? 'unknown playlist').toString();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('remove from downloads?'),
        content: Text('this will delete local files for "$name".'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('remove'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      await OfflineService().deletePlaylist(widget.playlist['id'].toString());
      if (mounted) {
        setState(() {
          _isPlaylistOffline = false;
          _playlistDownloadProgress = 0.0;
        });
      }
    }
  }
}
