import 'package:flutter/material.dart';

class TrackListItem extends StatelessWidget {
  final Map<String, dynamic> track;
  final String? coverArtUrl;
  final VoidCallback? onTap;

  const TrackListItem({
    super.key,
    required this.track,
    this.coverArtUrl,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    // note: we are preserving the original case from the api for metadata.
    final String title = (track['title'] ?? 'unknown title').toString();
    final String artist = (track['artist'] ?? 'unknown artist').toString();
    
    final int durationInSeconds = (track['duration'] as num?)?.toInt() ?? 0;
    final int minutes = durationInSeconds ~/ 60;
    final int seconds = durationInSeconds % 60;
    final String duration = '$minutes:${seconds.toString().padLeft(2, '0')}';

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: SizedBox(
                width: 48,
                height: 48,
                child: coverArtUrl != null
                    ? Image.network(
                        coverArtUrl!,
                        fit: BoxFit.cover,
                        errorBuilder: (context, error, stackTrace) => _buildPlaceholder(),
                      )
                    : _buildPlaceholder(),
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
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
            Text(
              duration,
              style: theme.textTheme.labelMedium?.copyWith(
                color: colorScheme.onSurfaceVariant,
                fontFeatures: const [FontFeature.tabularFigures()],
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
      child: const Icon(Icons.music_note_rounded, size: 24, color: Colors.grey),
    );
  }
}
