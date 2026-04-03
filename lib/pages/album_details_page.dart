import 'dart:async';
import 'package:flutter/material.dart';
import 'package:navidrome_client/components/track_list_item.dart';
import 'package:navidrome_client/components/mini_player.dart';
import 'package:navidrome_client/pages/player_page.dart';
import 'package:navidrome_client/services/api_service.dart';
import 'package:navidrome_client/services/player_service.dart';
import 'package:navidrome_client/services/offline_service.dart';
import 'package:navidrome_client/components/offline_image.dart';

class AlbumDetailsPage extends StatefulWidget {
  final Map<String, dynamic> album;
  final ApiService apiService;

  const AlbumDetailsPage({
    super.key,
    required this.album,
    required this.apiService,
  });

  @override
  State<AlbumDetailsPage> createState() => _AlbumDetailsPageState();
}

class _AlbumDetailsPageState extends State<AlbumDetailsPage> {
  List<Map<String, dynamic>> _tracks = [];
  bool _isLoading = true;

  // computed once in initState — no recurring rebuild
  late final bool _isOfflineMode;
  bool _isAlbumOffline = false;

  // download progress for the album button
  double _albumDownloadProgress = 0.0;
  StreamSubscription<OfflineProgress>? _albumProgressSub;

  @override
  void initState() {
    super.initState();
    final offline = OfflineService();

    // #1: read synchronously from the already-initialized in-memory state
    _isOfflineMode = offline.isOfflineMode;
    _isAlbumOffline = offline.isAlbumOfflineSync(widget.album['id'].toString());

    _subscribeToAlbumProgress();
    _loadTracks();
  }

  void _subscribeToAlbumProgress() {
    final albumId = widget.album['id'].toString();
    _albumProgressSub = OfflineService().getDownloadProgress(albumId).listen((p) {
      if (!mounted) return;
      setState(() {
        _albumDownloadProgress = p.fraction;
        if (p.isDone) {
          _isAlbumOffline = OfflineService().isAlbumOfflineSync(widget.album['id'].toString());
        }
      });
    });
  }

  @override
  void dispose() {
    _albumProgressSub?.cancel();
    super.dispose();
  }

  Future<void> _loadTracks() async {
    final offlineService = OfflineService();
    final albumId = widget.album['id'].toString();

    // #1: now this check is reliable — _isOfflineMode was set synchronously
    if (_isOfflineMode) {
      final cached = await offlineService.getCachedAlbumMetadata(albumId);
      if (cached != null && mounted) {
        setState(() {
          _tracks = cached;
          _isLoading = false;
        });
        return;
      }
    }

    try {
      final tracks = await widget.apiService.getTracks(albumId);
      // always cache metadata for future offline use
      await offlineService.saveAlbumMetadata(albumId, tracks);

      if (mounted) {
        setState(() {
          _tracks = tracks;
          _isLoading = false;
        });
      }
    } catch (e) {
      // fallback to cached metadata on any network failure
      final cached = await offlineService.getCachedAlbumMetadata(albumId);
      if (cached != null && mounted) {
        setState(() {
          _tracks = cached;
          _isLoading = false;
        });
      } else if (mounted) {
        setState(() { _isLoading = false; });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('failed to load tracks and no offline data found: ${e.toString()}')),
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

    // note: we are preserving the original case from the api for metadata.
    final String albumName = (widget.album['name'] ?? 'unknown album').toString();
    final String? coverArtId = widget.album['coverArt']?.toString();
    final String? coverArtUrl = coverArtId != null
        ? widget.apiService.getCoverArtUrl(coverArtId, size: 600)
        : null;

    final bool isDownloading = _albumDownloadProgress > 0 && _albumDownloadProgress < 1.0;

    return Scaffold(
      body: Stack(
        children: [
          CustomScrollView(
            slivers: [
              SliverAppBar(
                pinned: true,
                expandedHeight: 300,
                backgroundColor: colorScheme.surface,
                flexibleSpace: FlexibleSpaceBar(
                  title: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Flexible(
                        child: Text(
                          albumName,
                          style: theme.textTheme.headlineSmall?.copyWith(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                            shadows: const [
                              Shadow(
                                blurRadius: 12,
                                color: Colors.black54,
                                offset: Offset(0, 2),
                              ),
                            ],
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
                                  value: _albumDownloadProgress,
                                  strokeWidth: 2,
                                  color: colorScheme.onSecondaryContainer,
                                ),
                              )
                            : _isAlbumOffline
                                ? const Icon(Icons.download_done_rounded, size: 20)
                                : const Icon(Icons.download_for_offline_rounded, size: 20),
                        onPressed: isDownloading || (_isAlbumOffline && !_isOfflineMode) || (_tracks.isEmpty && !_isOfflineMode)
                            ? null
                            : () {
                                if (_isAlbumOffline) {
                                  _showDeleteAlbumConfirmation(context);
                                } else {
                                  OfflineService().downloadAlbum(
                                    widget.album['id'].toString(),
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
                  child: Center(child: Text('no tracks in this album')),
                )
              else
                SliverPadding(
                  padding: const EdgeInsets.only(top: 8, bottom: 100),
                  sliver: SliverList(
                    delegate: SliverChildBuilderDelegate(
                      (context, index) {
                        // #4: _tracksToDisplay is a getter computed once per build,
                        // not inside the item builder
                        final tracks = _tracksToDisplay;
                        if (index >= tracks.length) return null;

                        final track = tracks[index];
                        final trackCoverArtId = track['coverArt'] ?? widget.album['coverArt'];
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
    );
  }

  Future<void> _showDeleteAlbumConfirmation(BuildContext context) async {
    final albumName = (widget.album['name'] ?? 'unknown album').toString();
    
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('remove album from downloads?'),
        content: Text('this will delete all local files for "$albumName".'),
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
      await OfflineService().deleteAlbum(widget.album['id'].toString());
      if (mounted) {
        setState(() {
          _isAlbumOffline = false;
          _albumDownloadProgress = 0.0;
        });
      }
    }
  }
}
