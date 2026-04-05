import 'dart:async';
import 'package:flutter/material.dart';
import 'package:navidrome_client/services/offline_service.dart';
import 'package:navidrome_client/components/offline_image.dart';

class PlaylistListItem extends StatefulWidget {
  final Map<String, dynamic> playlist;
  final String? coverArtUrl;
  final VoidCallback onTap;

  const PlaylistListItem({
    super.key,
    required this.playlist,
    this.coverArtUrl,
    required this.onTap,
  });

  @override
  State<PlaylistListItem> createState() => _PlaylistListItemState();
}

class _PlaylistListItemState extends State<PlaylistListItem> {
  late final OfflineService _offline;
  late String _playlistId;
  bool _isOffline = false;
  double _progress = 0.0;
  StreamSubscription<OfflineProgress>? _progressSub;

  @override
  void initState() {
    super.initState();
    _offline = OfflineService();
    _playlistId = widget.playlist['id'].toString();
    _isOffline = _offline.isPlaylistOfflineSync(_playlistId);
    _offline.addListener(_onOfflineServiceChanged);
    _subscribeToProgress();
  }

  void _onOfflineServiceChanged() {
    final status = _offline.isPlaylistOfflineSync(_playlistId);
    if (status != _isOffline) {
      if (mounted) setState(() { _isOffline = status; });
    }
  }

  void _subscribeToProgress() {
    _progressSub?.cancel();
    _progressSub = _offline.getDownloadProgress(_playlistId).listen((p) {
      if (!mounted) return;
      setState(() {
        _progress = p.fraction;
        if (p.isDone) _isOffline = _offline.isPlaylistOfflineSync(_playlistId);
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

    final String name = (widget.playlist['name'] ?? 'unknown playlist').toString();
    final int songCount = (widget.playlist['songCount'] as num?)?.toInt() ?? 0;

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
                coverArtId: widget.playlist['coverArt']?.toString(),
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
                        child: Text(
                          _isOffline ? 'available offline' : 'online',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: theme.textTheme.bodyMedium?.copyWith(
                            color: colorScheme.onSurfaceVariant,
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
      child: const Icon(Icons.playlist_play_rounded, size: 32, color: Colors.grey),
    );
  }
}
