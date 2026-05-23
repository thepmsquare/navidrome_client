import 'dart:io' show Platform;
import 'package:flutter/material.dart';
import 'package:navidrome_client/pages/event_log_page.dart';
import 'package:navidrome_client/services/offline_service.dart';
import 'package:navidrome_client/services/event_log_service.dart';
import 'package:navidrome_client/services/export_service.dart';
import 'package:navidrome_client/services/player_service.dart';
import 'package:navidrome_client/services/session_service.dart';

class AdvancedSettingsPage extends StatefulWidget {
  const AdvancedSettingsPage({super.key});

  @override
  State<AdvancedSettingsPage> createState() => _AdvancedSettingsPageState();
}

class _AdvancedSettingsPageState extends State<AdvancedSettingsPage> {
  final _sessionService = SessionService();
  final _eventLog = EventLogService();
  bool _stopPlaybackOnTaskRemoved = true;
  int _logErrorCount = 0;

  @override
  void initState() {
    super.initState();
    _loadSettings();
    _logErrorCount = _eventLog.errorCount;
    _eventLog.changeNotifier.addListener(_onLogChanged);
  }

  @override
  void dispose() {
    _eventLog.changeNotifier.removeListener(_onLogChanged);
    super.dispose();
  }

  void _onLogChanged() {
    final count = _eventLog.errorCount;
    if (count != _logErrorCount && mounted) {
      setState(() {
        _logErrorCount = count;
      });
    }
  }

  Future<void> _loadSettings() async {
    final stopPlayback = await _sessionService.stopPlaybackOnTaskRemoved;
    if (mounted) {
      setState(() {
        _stopPlaybackOnTaskRemoved = stopPlayback;
      });
    }
  }

  Future<void> _toggleStopPlaybackOnTaskRemoved(bool value) async {
    await _sessionService.setStopPlaybackOnTaskRemoved(value);
    PlayerService().setStopPlaybackOnTaskRemoved(value);
    if (mounted) {
      setState(() {
        _stopPlaybackOnTaskRemoved = value;
      });
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
          appBar: AppBar(title: const Text('advanced'), primary: !isOffline),
          body: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              if (Platform.isAndroid)
                Card(
                  child: SwitchListTile(
                    secondary: const Icon(Icons.stop_circle_rounded),
                    title: const Text(
                      'stop playback when app is removed from background tasks',
                    ),
                    subtitle: const Text(
                      'automatically stop music when swiped away from recent apps',
                    ),
                    value: _stopPlaybackOnTaskRemoved,
                    onChanged: _toggleStopPlaybackOnTaskRemoved,
                  ),
                ),
              const SizedBox(height: 8),
              Card(
                child: ListTile(
                  leading: const Icon(Icons.backup_rounded),
                  title: const Text('backup configuration'),
                  subtitle: const Text(
                    'save your server details and settings to a file',
                  ),
                  trailing: const Icon(Icons.chevron_right_rounded),
                  onTap: () async {
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
                          'security warning',
                          style: theme.textTheme.headlineSmall?.copyWith(
                            color: colorScheme.error,
                            fontWeight: FontWeight.bold,
                          ),
                          textAlign: TextAlign.center,
                        ),
                        content: const Text(
                          'the backup file will contain your server password in plain text. please ensure you save this file in a secure location and do not share it with others.',
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
                              backgroundColor: colorScheme.primary,
                              foregroundColor: colorScheme.onPrimary,
                            ),
                            onPressed: () => Navigator.pop(context, true),
                            child: const Text('i understand, backup'),
                          ),
                        ],
                      ),
                    );

                    if (confirmed == true) {
                      final success = await ExportService().exportSettings();
                      if (mounted) {
                        // ignore: use_build_context_synchronously
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text(
                              success
                                  ? 'backup created successfully'
                                  : 'failed to create backup',
                            ),
                          ),
                        );
                      }
                    }
                  },
                ),
              ),
              const SizedBox(height: 8),
              Card(
                child: Column(
                  children: [
                    ListTile(
                      leading: Badge(
                        isLabelVisible: _logErrorCount > 0,
                        label: Text(
                          _logErrorCount > 99
                              ? '99+'
                              : _logErrorCount.toString(),
                        ),
                        backgroundColor: colorScheme.error,
                        textColor: colorScheme.onError,
                        child: const Icon(Icons.bug_report_rounded),
                      ),
                      title: const Text('event log'),
                      subtitle: const Text('debug events and errors'),
                      trailing: const Icon(Icons.chevron_right_rounded),
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (context) => const EventLogPage(),
                          ),
                        );
                      },
                    ),
                    ListTile(
                      leading: const Icon(Icons.bolt_rounded),
                      title: const Text('trigger test error'),
                      subtitle: const Text('verify sentry integration'),
                      onTap: () => throw Exception('sentry test error'),
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
