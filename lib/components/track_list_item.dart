import 'package:flutter/material.dart';

class TrackListItem extends StatelessWidget {
  final Map<String, dynamic> track;
  final String? coverArtUrl;

  const TrackListItem({
    super.key,
    required this.track,
    this.coverArtUrl,
  });

  @override
  Widget build(BuildContext context) {
    // lowercase title and artist
    final String title = (track['title'] ?? 'unknown title').toString().toLowerCase();
    final String artist = (track['artist'] ?? 'unknown artist').toString().toLowerCase();
    
    // duration formatting
    final int durationInSeconds = (track['duration'] as num?)?.toInt() ?? 0;
    final int minutes = durationInSeconds ~/ 60;
    final int seconds = durationInSeconds % 60;
    final String duration = '$minutes:${seconds.toString().padLeft(2, '0')}';

    return ListTile(
      leading: ClipRRect(
        borderRadius: BorderRadius.circular(4),
        child: SizedBox(
          width: 48,
          height: 48,
          child: coverArtUrl != null
              ? Image.network(
                  coverArtUrl!,
                  fit: BoxFit.cover,
                  errorBuilder: (context, error, stackTrace) => _buildPlaceholder(),
                  loadingBuilder: (context, child, loadingProgress) {
                    if (loadingProgress == null) return child;
                    return _buildPlaceholder();
                  },
                )
              : _buildPlaceholder(),
        ),
      ),
      title: Text(
        title,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: Theme.of(context).textTheme.bodyLarge?.copyWith(
              fontWeight: FontWeight.w500,
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
        duration,
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: Theme.of(context).colorScheme.outline,
            ),
      ),
      onTap: () {
        // play track logic can be added later
      },
    );
  }

  Widget _buildPlaceholder() {
    return Container(
      color: Colors.grey.withOpacity(0.2),
      child: const Icon(Icons.music_note_outlined, size: 24, color: Colors.grey),
    );
  }
}
