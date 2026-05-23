import 'package:flutter/material.dart';
import 'package:navidrome_client/services/offline_service.dart';
import 'package:navidrome_client/services/session_service.dart';
import 'package:navidrome_client/utils/disk_utility.dart';

class OfflineSavesSettingsPage extends StatefulWidget {
  const OfflineSavesSettingsPage({super.key});

  @override
  State<OfflineSavesSettingsPage> createState() => _OfflineSavesSettingsPageState();
}

class _OfflineSavesSettingsPageState extends State<OfflineSavesSettingsPage> {
  final _sessionService = SessionService();
  int _offlineSize = 0;
  bool _isRefreshingStorage = false;
  bool _autoSaveOfflinePlayed = true;
  double _autoSaveOfflineMaxGib = 1.0;
  bool _autoSaveOfflineLruEvict = true;

  @override
  void initState() {
    super.initState();
    _loadSettings();
    _refreshStorageStats();
  }

  Future<void> _loadSettings() async {
    final autoEnabled = await _sessionService.autoSaveOfflinePlayed;
    final autoMaxBytes = await _sessionService.autoSaveOfflineMaxBytes;
    final autoLru = await _sessionService.autoSaveOfflineLruEvict;
    if (mounted) {
      setState(() {
        _autoSaveOfflinePlayed = autoEnabled;
        _autoSaveOfflineMaxGib = autoMaxBytes / (1024 * 1024 * 1024);
        _autoSaveOfflineLruEvict = autoLru;
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

  Future<void> _toggleAutoSaveOfflinePlayed(bool value) async {
    await _sessionService.setAutoSaveOfflinePlayed(value);
    if (mounted) setState(() => _autoSaveOfflinePlayed = value);
  }

  Future<void> _toggleAutoSaveOfflineLruEvict(bool value) async {
    await _sessionService.setAutoSaveOfflineLruEvict(value);
    if (mounted) setState(() => _autoSaveOfflineLruEvict = value);
  }

  Future<void> _showCapInputDialog() async {
    final controller = TextEditingController(
      text: _autoSaveOfflineMaxGib.toStringAsFixed(
        _autoSaveOfflineMaxGib == _autoSaveOfflineMaxGib.truncateToDouble() ? 0 : 2,
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
        await _sessionService.setAutoSaveOfflineMaxBytes(bytes);
        if (mounted) setState(() => _autoSaveOfflineMaxGib = parsed);
      }
    }
    controller.dispose();
  }

  Future<void> _confirmClearOfflineSaves() async {
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
          'clear all offline saves?',
          style: theme.textTheme.headlineSmall?.copyWith(
            color: colorScheme.error,
            fontWeight: FontWeight.bold,
          ),
          textAlign: TextAlign.center,
        ),
        content: const Text(
          'this action is permanent and will remove all of your offline music and metadata. you will need to re-save everything offline if you want to listen offline again.',
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
          await OfflineService().clearAllOfflineSaves();
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

    return ValueListenableBuilder<OfflineState>(
      valueListenable: OfflineService().offlineModeNotifier,
      builder: (context, state, child) {
        final isOffline = state != OfflineState.online;
        return Scaffold(
          appBar: AppBar(
            title: const Text('offline saves'),
            primary: !isOffline,
          ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Column(
              children: [
                ListTile(
                  leading: const Icon(Icons.download_for_offline_rounded),
                  title: const Text('offline saves'),
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
                  title: const Text('auto-save offline played songs'),
                  subtitle: const Text(
                    'automatically save songs offline as they play',
                  ),
                  value: _autoSaveOfflinePlayed,
                  onChanged: _toggleAutoSaveOfflinePlayed,
                ),
                if (_autoSaveOfflinePlayed) ...[
                  ListTile(
                    leading: const Icon(Icons.storage_rounded),
                    title: const Text('storage cap'),
                    subtitle: Text(
                      '${_autoSaveOfflineMaxGib.toStringAsFixed(_autoSaveOfflineMaxGib == _autoSaveOfflineMaxGib.truncateToDouble() ? 0 : 2)} gib',
                    ),
                    trailing: const Icon(Icons.edit_rounded),
                    onTap: _showCapInputDialog,
                  ),
                  SwitchListTile(
                    secondary: const Icon(Icons.auto_delete_rounded),
                    title: const Text('evict oldest when storage is full'),
                    subtitle: const Text(
                      'remove the oldest auto-saved offline song to make room for new ones',
                    ),
                    value: _autoSaveOfflineLruEvict,
                    onChanged: _toggleAutoSaveOfflineLruEvict,
                  ),
                ],
                if (_offlineSize > 0)
                  Padding(
                    padding: const EdgeInsets.all(8.0),
                    child: OutlinedButton.icon(
                      onPressed: _confirmClearOfflineSaves,
                      style: OutlinedButton.styleFrom(
                        foregroundColor: colorScheme.error,
                        side: BorderSide(color: colorScheme.error),
                      ),
                      icon: const Icon(Icons.delete_forever_rounded),
                      label: const Text('clear all offline saves'),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
      },
    );
  }
}
