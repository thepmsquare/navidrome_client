import 'package:flutter/material.dart';

class AlbumListItem extends StatelessWidget {
  final Map<String, dynamic> album;
  final String? coverArtUrl;
  final VoidCallback onTap;

  const AlbumListItem({
    super.key,
    required this.album,
    this.coverArtUrl,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final String name = (album['name'] ?? 'unknown album').toString().toLowerCase();
    final String artist = (album['artist'] ?? 'unknown artist').toString().toLowerCase();
    final int songCount = (album['songCount'] as num?)?.toInt() ?? 0;

    return ListTile(
      leading: ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: SizedBox(
          width: 56,
          height: 56,
          child: coverArtUrl != null
              ? Image.network(
                  coverArtUrl!,
                  fit: BoxFit.cover,
                  errorBuilder: (context, error, stackTrace) => _buildPlaceholder(),
                )
              : _buildPlaceholder(),
        ),
      ),
      title: Text(
        name,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: Theme.of(context).textTheme.bodyLarge?.copyWith(
              fontWeight: FontWeight.bold,
            ),
      ),
      subtitle: Text(
        artist,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: Theme.of(context).colorScheme.outline,
            ),
      ),
      trailing: Text(
        '$songCount tracks',
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: Theme.of(context).colorScheme.outline,
            ),
      ),
      onTap: onTap,
    );
  }

  Widget _buildPlaceholder() {
    return Container(
      color: Colors.grey.withOpacity(0.2),
      child: const Icon(Icons.album_outlined, size: 28, color: Colors.grey),
    );
  }
}
