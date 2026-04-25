import 'dart:async';
import 'package:flutter/material.dart';
import 'package:navidrome_client/services/offline_service.dart';
import 'package:navidrome_client/components/offline_image.dart';

class AlbumListItem extends StatefulWidget {
  final Map<String, dynamic> album;
  final String? coverArtUrl;
  final VoidCallback onTap;
  final VoidCallback? onArtistTap;

  const AlbumListItem({
    super.key,
    required this.album,
    this.coverArtUrl,
    required this.onTap,
    this.onArtistTap,
  });

  @override
  State<AlbumListItem> createState() => _AlbumListItemState();
}

class _AlbumListItemState extends State<AlbumListItem> {
  late final OfflineService _offline;
  late String _albumId;
  bool _isOffline = false;
  double _progress = 0.0;
  StreamSubscription<OfflineProgress>? _progressSub;

  @override
  void initState() {
    super.initState();
    _offline = OfflineService();
    _albumId = widget.album['id'].toString();
    // #7: synchronous check using in-memory set
    _isOffline = _offline.isAlbumOfflineSync(_albumId);
    _offline.addListener(_onOfflineServiceChanged);
    _subscribeToProgress();
  }

  void _onOfflineServiceChanged() {
    final status = _offline.isAlbumOfflineSync(_albumId);
    if (status != _isOffline) {
      if (mounted) setState(() { _isOffline = status; });
    }
  }

  void _subscribeToProgress() {
    _progressSub?.cancel();
    _progressSub = _offline.getDownloadProgress(_albumId).listen((p) {
      if (!mounted) return;
      setState(() {
        _progress = p.fraction;
        if (p.isDone) _isOffline = _offline.isAlbumOfflineSync(_albumId);
      });
    });
  }

  @override
  void dispose() {
    _offline.removeListener(_onOfflineServiceChanged);
    _progressSub?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    // note: we are preserving the original case from the api for metadata.
    final String name = (widget.album['name'] ?? 'unknown album').toString();
    final String artist = (widget.album['artist'] ?? 'unknown artist').toString();
    final int songCount = (widget.album['songCount'] as num?)?.toInt() ?? 0;

    final bool isDownloading = _progress > 0 && _progress < 1.0;

    return InkWell(
      onTap: widget.onTap,
      borderRadius: BorderRadius.circular(16),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: OfflineImage(
                coverArtId: widget.album['coverArt']?.toString(),
                remoteUrl: widget.coverArtUrl,
                width: 64,
                height: 64,
                placeholder: _buildPlaceholder(),
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      if (isDownloading) ...[
                        SizedBox(
                          width: 14,
                          height: 14,
                          child: CircularProgressIndicator(
                            value: _progress,
                            strokeWidth: 2,
                          ),
                        ),
                        const SizedBox(width: 8),
                      ] else if (_isOffline) ...[
                        Icon(
                          Icons.check_circle_rounded,
                          size: 16,
                          color: colorScheme.primary,
                        ),
                        const SizedBox(width: 4),
                      ],
                      Flexible(
                        child: GestureDetector(
                          onTap: widget.onArtistTap,
                          child: Text(
                            artist,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: theme.textTheme.bodyMedium?.copyWith(
                              color: widget.onArtistTap != null 
                                  ? colorScheme.primary 
                                  : colorScheme.onSurfaceVariant,
                              fontWeight: widget.onArtistTap != null ? FontWeight.bold : FontWeight.normal,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: colorScheme.surfaceContainerHigh,
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                '$songCount tracks',
                style: theme.textTheme.labelSmall?.copyWith(
                  color: colorScheme.primary,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPlaceholder() {
    return Container(
      color: Colors.grey.withValues(alpha: 0.1),
      child: const Icon(Icons.album_rounded, size: 32, color: Colors.grey),
    );
  }
}
