import 'package:flutter/material.dart';
import 'package:navidrome_client/services/player_service.dart';
import 'package:navidrome_client/services/api_service.dart';
import 'package:navidrome_client/components/queue_list_item.dart';

class QueuePage extends StatefulWidget {
  final ApiService apiService;

  const QueuePage({super.key, required this.apiService});

  @override
  State<QueuePage> createState() => _QueuePageState();
}

class _QueuePageState extends State<QueuePage> {
  final PlayerService _playerService = PlayerService();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Scaffold(
      appBar: AppBar(
        title: const Text('queue'),
        centerTitle: true,
        actions: [
          IconButton(
            icon: const Icon(Icons.delete_sweep_rounded),
            onPressed: () => _showClearConfirmation(context),
            tooltip: 'clear queue',
          ),
        ],
      ),
      body: StreamBuilder<int?>(
        stream: _playerService.currentIndexStream,
        builder: (context, snapshot) {
          final currentQueue = _playerService.currentQueue;
          final currentIndex = _playerService.player.currentIndex;

          if (currentQueue.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.music_off_rounded,
                    size: 64,
                    color: colorScheme.onSurfaceVariant.withValues(alpha: 0.5),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'queue is empty',
                    style: theme.textTheme.titleMedium?.copyWith(
                      color: colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            );
          }

          return ReorderableListView.builder(
            itemCount: currentQueue.length,
            onReorder: (oldIndex, newIndex) {
              if (newIndex > oldIndex) {
                newIndex -= 1;
              }
              if (oldIndex != newIndex) {
                setState(() {
                  _playerService.reorderQueue(oldIndex, newIndex);
                });
              }
            },
            itemBuilder: (context, index) {
              final track = currentQueue[index];
              final isPlaying = index == currentIndex;

              return QueueListItem(
                key: ValueKey('${track['id']}_$index'),
                track: track,
                index: index,
                apiService: widget.apiService,
                isPlaying: isPlaying,
                onTap: () {
                  _playerService.player.seek(Duration.zero, index: index);
                },
                onRemove: () {
                  setState(() {
                    _playerService.removeFromQueue(index);
                  });
                },
              );
            },
          );
        },
      ),
    );
  }

  Future<void> _showClearConfirmation(BuildContext context) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('clear queue?'),
        content: const Text('this will stop playback and empty the queue.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('clear'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      await _playerService.clearQueue();
      if (mounted) setState(() {});
    }
  }
}
