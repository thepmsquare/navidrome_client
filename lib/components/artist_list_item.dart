import 'package:flutter/material.dart';
import 'package:navidrome_client/components/offline_image.dart';

class ArtistListItem extends StatelessWidget {
  final Map<String, dynamic> artist;
  final String? coverArtUrl;
  final VoidCallback onTap;

  const ArtistListItem({
    super.key,
    required this.artist,
    this.coverArtUrl,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    final String name = (artist['name'] ?? 'unknown artist').toString();
    final int albumCount = (artist['albumCount'] as num?)?.toInt() ?? 0;

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(32),
              child: OfflineImage(
                coverArtId: artist['coverArt']?.toString(),
                remoteUrl: coverArtUrl,
                width: 64,
                height: 64,
                placeholder: _buildPlaceholder(colorScheme),
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
                  Text(
                    '$albumCount albums',
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right_rounded, color: Colors.grey),
          ],
        ),
      ),
    );
  }

  Widget _buildPlaceholder(ColorScheme colorScheme) {
    return Container(
      color: colorScheme.surfaceContainerHighest,
      child: const Icon(Icons.person_rounded, size: 32, color: Colors.grey),
    );
  }
}
