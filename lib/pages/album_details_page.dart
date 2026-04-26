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

  late final bool _isOfflineMode;
  bool _isAlbumOffline = false;
  bool _downloadErrorShown = false;

  StreamSubscription<OfflineProgress>? _albumProgressSub;

  @override
  void initState() {
    super.initState();
    final offline = OfflineService();
    _isOfflineMode = offline.isOfflineMode;
    _isAlbumOffline = offline.isAlbumOfflineSync(widget.album['id'].toString());
    _subscribeToAlbumProgress();
    OfflineService().addListener(_onOfflineStatusChanged);
    _loadTracks();
  }


  void _onOfflineStatusChanged() {
    if (!mounted) return;
    // Only rebuild the whole page if we are in offline mode (to filter the list)
    // or if the album's own status changed.
    final newStatus = OfflineService().isAlbumOfflineSync(widget.album['id'].toString());
    if (_isOfflineMode || newStatus != _isAlbumOffline) {
      setState(() {
        _isAlbumOffline = newStatus;
      });
    }
  }

  void _subscribeToAlbumProgress() {
    final albumId = widget.album['id'].toString();
    _albumProgressSub = OfflineService().getDownloadProgress(albumId).listen((p) {
      if (!mounted) return;
      
      if (p.hasError && !_downloadErrorShown) {
        _downloadErrorShown = true;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('some tracks failed to download. please try again.')),
        );
      }

      if (p.isDone) {
        final newStatus = OfflineService().isAlbumOfflineSync(widget.album['id'].toString());
        if (newStatus != _isAlbumOffline) {
          setState(() {
            _isAlbumOffline = newStatus;
          });
        }
      }
    });
  }

  @override
  void dispose() {
    _albumProgressSub?.cancel();
    OfflineService().removeListener(_onOfflineStatusChanged);
    super.dispose();
  }

  Future<void> _loadTracks() async {
    final offlineService = OfflineService();
    final albumId = widget.album['id'].toString();

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
      await offlineService.saveAlbumMetadata(albumId, tracks);

      if (mounted) {
        setState(() {
          _tracks = tracks;
          _isLoading = false;
        });
      }
    } catch (e) {
      final cached = await offlineService.getCachedAlbumMetadata(albumId);
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

    final String albumName = (widget.album['name'] ?? 'unknown album').toString();
    final String? coverArtId = widget.album['coverArt']?.toString();
    final String? coverArtUrl = coverArtId != null
        ? widget.apiService.getCoverArtUrl(coverArtId, size: 600)
        : null;


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
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  SingleChildScrollView(
                                    scrollDirection: Axis.horizontal,
                                    child: Text(
                                      albumName,
                                      style: theme.textTheme.titleMedium?.copyWith(
                                        color: Colors.white,
                                        fontWeight: FontWeight.bold,
                                        shadows: const [
                                          Shadow(blurRadius: 12, color: Colors.black54, offset: Offset(0, 2)),
                                        ],
                                      ),
                                    ),
                                  ),
                                  GestureDetector(
                                    onTap: () {
                                      final artistId = widget.album['artistId']?.toString();
                                      if (artistId != null) {
                                        Navigator.push(
                                          context,
                                          MaterialPageRoute(
                                            builder: (context) => ArtistDetailsPage(
                                              artist: {
                                                'id': artistId,
                                                'name': widget.album['artist'],
                                                'coverArt': widget.album['coverArt'],
                                              },
                                              apiService: widget.apiService,
                                            ),
                                          ),
                                        );
                                      }
                                    },
                                    child: Text(
                                      (widget.album['artist'] ?? '').toString(),
                                      style: theme.textTheme.labelMedium?.copyWith(
                                        color: Colors.white70,
                                        decoration: TextDecoration.underline,
                                        decorationColor: Colors.white30,
                                      ),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 8),
                            StreamBuilder<OfflineProgress>(
                              stream: OfflineService().getDownloadProgress(widget.album['id'].toString()),
                              builder: (context, snapshot) {
                                final p = snapshot.data;
                                final double progress = p?.fraction ?? 0.0;
                                final bool downloading = p != null && !p.isDone && progress > 0;

                                return IconButton.filledTonal(
                                  icon: downloading
                                      ? SizedBox(
                                          width: 18,
                                          height: 18,
                                          child: CircularProgressIndicator(
                                            value: progress,
                                            strokeWidth: 2,
                                            color: colorScheme.onSecondaryContainer,
                                          ),
                                        )
                                      : _isAlbumOffline
                                          ? const Icon(Icons.download_done_rounded, size: 20)
                                          : const Icon(Icons.download_for_offline_rounded, size: 20),
                                  onPressed: downloading || (_isAlbumOffline && !_isOfflineMode) || (_tracks.isEmpty && !_isOfflineMode)
                                      ? null
                                      : () {
                                          if (_isAlbumOffline) {
                                            _showDeleteAlbumConfirmation(context);
                                          } else {
                                            _downloadErrorShown = false;
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
                                );
                              },
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
        });
      }
    }
  }
}
