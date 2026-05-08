import 'package:flutter/material.dart';
import 'package:navidrome_client/services/offline_service.dart';
import 'package:navidrome_client/services/session_service.dart';
import 'package:navidrome_client/utils/disk_utility.dart';

class DownloadsSettingsPage extends StatefulWidget {
  const DownloadsSettingsPage({super.key});

  @override
  State<DownloadsSettingsPage> createState() => _DownloadsSettingsPageState();
}

class _DownloadsSettingsPageState extends State<DownloadsSettingsPage> {
  final _sessionService = SessionService();
  int _offlineSize = 0;
  bool _isRefreshingStorage = false;
  bool _autoDownloadPlayed = true;
  double _autoDownloadMaxGib = 1.0;
  bool _autoDownloadLruEvict = true;

  @override
  void initState() {
    super.initState();
    _loadSettings();
    _refreshStorageStats();
  }

  Future<void> _loadSettings() async {
    final autoEnabled = await _sessionService.autoDownloadPlayed;
    final autoMaxBytes = await _sessionService.autoDownloadMaxBytes;
    final autoLru = await _sessionService.autoDownloadLruEvict;
    if (mounted) {
      setState(() {
        _autoDownloadPlayed = autoEnabled;
        _autoDownloadMaxGib = autoMaxBytes / (1024 * 1024 * 1024);
        _autoDownloadLruEvict = autoLru;
      });
    }
  }

  Future<void> _refreshStorageStats() async {
    if (_isRefreshingStorage) return;
    setState(() {
      _isRefreshingStorage = true;
    });

    try {
      final size = await DiskUtility.getOfflineSize();
      if (mounted) {
        setState(() {
          _offlineSize = size;
        });
      }
    } finally {
      if (mounted) {
        setState(() {
          _isRefreshingStorage = false;
        });
      }
    }
  }

  Future<void> _toggleAutoDownloadPlayed(bool value) async {
    await _sessionService.setAutoDownloadPlayed(value);
    if (mounted) setState(() => _autoDownloadPlayed = value);
  }

  Future<void> _toggleAutoDownloadLruEvict(bool value) async {
    await _sessionService.setAutoDownloadLruEvict(value);
    if (mounted) setState(() => _autoDownloadLruEvict = value);
  }

  Future<void> _showCapInputDialog() async {
    final controller = TextEditingController(
      text: _autoDownloadMaxGib.toStringAsFixed(
        _autoDownloadMaxGib == _autoDownloadMaxGib.truncateToDouble() ? 0 : 2,
      ),
    );
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('storage cap'),
        content: TextField(
          controller: controller,
          autofocus: true,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          decoration: const InputDecoration(
            suffixText: 'gib',
            hintText: '1.0',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('save'),
          ),
        ],
      ),
    );
    if (confirmed == true) {
      final parsed = double.tryParse(controller.text.trim());
      if (parsed != null && parsed > 0) {
        final bytes = (parsed * 1024 * 1024 * 1024).round();
        await _sessionService.setAutoDownloadMaxBytes(bytes);
        if (mounted) setState(() => _autoDownloadMaxGib = parsed);
      }
    }
    controller.dispose();
  }

  Future<void> _confirmClearDownloads() async {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        icon: Icon(
          Icons.warning_amber_rounded,
          color: colorScheme.error,
          size: 48,
        ),
        title: Text(
          'clear all downloads?',
          style: theme.textTheme.headlineSmall?.copyWith(
            color: colorScheme.error,
            fontWeight: FontWeight.bold,
          ),
          textAlign: TextAlign.center,
        ),
        content: const Text(
          'this action is permanent and will remove all of your offline music and metadata. you will need to re-download everything if you want to listen offline again.',
          textAlign: TextAlign.center,
        ),
        actionsAlignment: MainAxisAlignment.center,
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('cancel'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: colorScheme.error,
              foregroundColor: colorScheme.onError,
            ),
            onPressed: () => Navigator.pop(context, true),
            child: const Text('clear all'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      if (mounted) {
        setState(() {
          _isRefreshingStorage = true;
        });
        try {
          await OfflineService().clearAllDownloads();
          final size = await DiskUtility.getOfflineSize();
          if (mounted) {
            setState(() {
              _offlineSize = size;
            });
          }
        } finally {
          if (mounted) {
            setState(() {
              _isRefreshingStorage = false;
            });
          }
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Scaffold(
      appBar: AppBar(
        title: const Text('downloads'),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Column(
              children: [
                ListTile(
                  leading: const Icon(Icons.download_for_offline_rounded),
                  title: const Text('downloads'),
                  subtitle: Text(
                    '${DiskUtility.formatBytes(_offlineSize)} of media saved offline',
                  ),
                  trailing: _isRefreshingStorage
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : IconButton(
                          icon: const Icon(Icons.refresh_rounded),
                          onPressed: _refreshStorageStats,
                        ),
                ),
                SwitchListTile(
                  secondary: const Icon(Icons.download_rounded),
                  title: const Text('auto-download played songs'),
                  subtitle: const Text(
                    'automatically save songs to offline storage as they play',
                  ),
                  value: _autoDownloadPlayed,
                  onChanged: _toggleAutoDownloadPlayed,
                ),
                if (_autoDownloadPlayed) ...[
                  ListTile(
                    leading: const Icon(Icons.storage_rounded),
                    title: const Text('storage cap'),
                    subtitle: Text(
                      '${_autoDownloadMaxGib.toStringAsFixed(_autoDownloadMaxGib == _autoDownloadMaxGib.truncateToDouble() ? 0 : 2)} gib',
                    ),
                    trailing: const Icon(Icons.edit_rounded),
                    onTap: _showCapInputDialog,
                  ),
                  SwitchListTile(
                    secondary: const Icon(Icons.auto_delete_rounded),
                    title: const Text('evict oldest when storage is full'),
                    subtitle: const Text(
                      'remove the oldest auto-downloaded song to make room for new ones',
                    ),
                    value: _autoDownloadLruEvict,
                    onChanged: _toggleAutoDownloadLruEvict,
                  ),
                ],
                if (_offlineSize > 0)
                  Padding(
                    padding: const EdgeInsets.all(8.0),
                    child: OutlinedButton.icon(
                      onPressed: _confirmClearDownloads,
                      style: OutlinedButton.styleFrom(
                        foregroundColor: colorScheme.error,
                        side: BorderSide(color: colorScheme.error),
                      ),
                      icon: const Icon(Icons.delete_forever_rounded),
                      label: const Text('clear all downloads'),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
