import 'dart:async';
import 'package:flutter/material.dart';
import 'package:navidrome_client/services/offline_service.dart';
import 'package:navidrome_client/services/api_service.dart';
import 'package:navidrome_client/components/offline_image.dart';

/// #13: removed redundant Row wrapping the title.
/// #14: StatefulWidget subscribes to the progress stream and updates correctly.
class TrackListItem extends StatefulWidget {
  final Map<String, dynamic> track;
  final String? coverArtUrl;
  final VoidCallback? onTap;
  final ApiService? apiService;

  const TrackListItem({
    super.key,
    required this.track,
    this.coverArtUrl,
    this.onTap,
    this.apiService,
  });

  @override
  State<TrackListItem> createState() => _TrackListItemState();
}

class _TrackListItemState extends State<TrackListItem> {
  late final OfflineService _offline;
  late String _trackId;
  // #14: track offline status and progress in state
  bool _isOffline = false;
  double _progress = 0.0;
  StreamSubscription<OfflineProgress>? _progressSub;

  @override
  void initState() {
    super.initState();
    _offline = OfflineService();
    _trackId = widget.track['id'].toString();
    // #7: synchronous check — no async needed if initialize() was called at startup
    _isOffline = _offline.isTrackOfflineSync(_trackId);
    _subscribeToProgress();
  }

  void _subscribeToProgress() {
    _progressSub?.cancel();
    _progressSub = _offline.getDownloadProgress(_trackId).listen((p) {
      if (!mounted) return;
      setState(() {
        _progress = p.fraction;
        if (p.isDone) _isOffline = _offline.isTrackOfflineSync(_trackId);
      });
    });
  }

  @override
  void didUpdateWidget(TrackListItem old) {
    super.didUpdateWidget(old);
    final newId = widget.track['id'].toString();
    if (newId != _trackId) {
      _trackId = newId;
      _isOffline = _offline.isTrackOfflineSync(_trackId);
      _progress = 0.0;
      _subscribeToProgress();
    }
  }

  @override
  void dispose() {
    _progressSub?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    // note: we are preserving the original case from the api for metadata.
    final String title = (widget.track['title'] ?? 'unknown title').toString();
    final String artist = (widget.track['artist'] ?? 'unknown artist').toString();

    final int durationInSeconds = (widget.track['duration'] as num?)?.toInt() ?? 0;
    final int minutes = durationInSeconds ~/ 60;
    final int seconds = durationInSeconds % 60;
    final String duration = '$minutes:${seconds.toString().padLeft(2, '0')}';


    return InkWell(
      onTap: widget.onTap,
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: OfflineImage(
                coverArtId: widget.track['coverArt']?.toString(),
                remoteUrl: widget.coverArtUrl,
                width: 48,
                height: 48,
                placeholder: _buildPlaceholder(),
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // #13: no redundant Row — Expanded already handles overflow
                  Text(
                    title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.bodyLarge?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    artist,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            // duration always visible
            Text(
              duration,
              style: theme.textTheme.labelMedium?.copyWith(
                color: colorScheme.onSurfaceVariant,
                fontFeatures: const [FontFeature.tabularFigures()],
              ),
            ),
            if (widget.apiService != null) ...[
              const SizedBox(width: 4),
              _buildDownloadWidget(colorScheme),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildDownloadWidget(ColorScheme colorScheme) {
    // #14: driven by state, not by a nested FutureBuilder
    if (_isOffline) {
      return IconButton(
        icon: Icon(
          Icons.check_circle_rounded,
          size: 20,
          color: colorScheme.primary,
        ),
        onPressed: () => _showDeleteConfirmation(context),
        style: IconButton.styleFrom(
          padding: EdgeInsets.zero,
          minimumSize: const Size(32, 32),
          visualDensity: VisualDensity.compact,
        ),
      );
    }

    if (_progress > 0 && _progress < 1.0) {
      return SizedBox(
        width: 20,
        height: 20,
        child: CircularProgressIndicator(
          value: _progress,
          strokeWidth: 2,
        ),
      );
    }

    return IconButton(
      icon: const Icon(Icons.download_for_offline_rounded, size: 20),
      onPressed: () => _offline.downloadTrack(widget.track, widget.apiService!),
      style: IconButton.styleFrom(
        padding: EdgeInsets.zero,
        minimumSize: const Size(32, 32),
        visualDensity: VisualDensity.compact,
      ),
    );
  }

  Widget _buildPlaceholder() {
    return Container(
      color: Colors.grey.withValues(alpha: 0.1),
      child: const Icon(Icons.music_note_rounded, size: 24, color: Colors.grey),
    );
  }

  Future<void> _showDeleteConfirmation(BuildContext context) async {
    final title = (widget.track['title'] ?? 'unknown title').toString();
    
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('remove from downloads?'),
        content: Text('this will delete the local file for "$title".'),
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
      await _offline.deleteTrack(_trackId);
      if (mounted) {
        setState(() {
          _isOffline = false;
          _progress = 0.0;
        });
      }
    }
  }
}
