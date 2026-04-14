import 'package:flutter/material.dart';
import 'package:navidrome_client/components/offline_image.dart';
import 'package:navidrome_client/services/api_service.dart';

class QueueListItem extends StatelessWidget {
  final Map<String, dynamic> track;
  final ApiService? apiService;
  final bool isPlaying;
  final VoidCallback? onTap;
  final VoidCallback? onRemove;
  final int index;

  const QueueListItem({
    super.key,
    required this.track,
    required this.index,
    this.apiService,
    this.isPlaying = false,
    this.onTap,
    this.onRemove,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    final String title = (track['title'] ?? 'unknown title').toString();
    final String artist = (track['artist'] ?? 'unknown artist').toString();
    final coverArtId = track['coverArt']?.toString();
    final coverArtUrl = coverArtId != null && apiService != null
        ? apiService!.getCoverArtUrl(coverArtId)
        : null;

    return ListTile(
      key: ValueKey(track['id']),
      minLeadingWidth: 0,
      horizontalTitleGap: 12,
      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      leading: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          ReorderableDragStartListener(
            index: index,
            child: const Icon(Icons.drag_handle_rounded, size: 20),
          ),
          const SizedBox(width: 12),
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: SizedBox(
              width: 48,
              height: 48,
              child: OfflineImage(
                coverArtId: coverArtId,
                remoteUrl: coverArtUrl,
                fit: BoxFit.cover,
                placeholder: _buildPlaceholder(),
              ),
            ),
          ),
        ],
      ),
      title: Text(
        title.toLowerCase(),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: theme.textTheme.bodyLarge?.copyWith(
          fontWeight: isPlaying ? FontWeight.bold : FontWeight.normal,
          color: isPlaying ? colorScheme.primary : colorScheme.onSurface,
        ),
      ),
      subtitle: Text(
        artist.toLowerCase(),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: theme.textTheme.bodySmall?.copyWith(
          color: isPlaying
              ? colorScheme.primary.withValues(alpha: 0.7)
              : colorScheme.onSurfaceVariant,
        ),
      ),
      trailing: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (isPlaying) ...[
            Icon(
              Icons.equalizer_rounded,
              size: 20,
              color: colorScheme.primary,
            ),
            const SizedBox(width: 8),
          ],
          IconButton(
            icon: const Icon(Icons.close_rounded, size: 20),
            onPressed: onRemove,
            tooltip: 'remove from queue',
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(),
            visualDensity: VisualDensity.compact,
          ),
        ],
      ),
      onTap: onTap,
    );
  }

  Widget _buildPlaceholder() {
    return Container(
      color: Colors.grey.withValues(alpha: 0.1),
      child: const Icon(Icons.music_note_rounded, size: 24, color: Colors.grey),
    );
  }
}
