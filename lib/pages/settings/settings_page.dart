import 'package:flutter/material.dart';
import 'package:navidrome_client/pages/settings/advanced_settings_page.dart';
import 'package:navidrome_client/pages/settings/downloads_settings_page.dart';
import 'package:navidrome_client/services/auth_service.dart';
import 'package:navidrome_client/services/event_log_service.dart';
import 'package:navidrome_client/services/offline_service.dart';
import 'package:navidrome_client/services/player_service.dart';
import 'package:navidrome_client/services/version_service.dart';
import 'package:package_info_plus/package_info_plus.dart';

class SettingsPage extends StatefulWidget {
  const SettingsPage({super.key});

  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  final _authService = AuthService();
  final _eventLog = EventLogService();
  String _appVersion = '';
  int _logErrorCount = 0;

  @override
  void initState() {
    super.initState();
    _loadAppVersion();
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

  Future<void> _loadAppVersion() async {
    final packageInfo = await PackageInfo.fromPlatform();
    if (mounted) {
      setState(() {
        _appVersion = '${packageInfo.version}+${packageInfo.buildNumber}';
      });
    }
  }

  Future<void> _handleLogout() async {
    await PlayerService().clearQueue();
    await _authService.logout();
    if (mounted) Navigator.pushReplacementNamed(context, '/connect');
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Column(
      children: [
        AppBar(
          title: const Text('settings'),
          automaticallyImplyLeading: false,
        ),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Card(
                child: ValueListenableBuilder<bool>(
                  valueListenable: OfflineService().offlineModeNotifier,
                  builder: (context, isOffline, child) {
                    return SwitchListTile(
                      secondary: const Icon(Icons.offline_pin_rounded),
                      title: const Text('offline mode'),
                      subtitle: const Text('only show downloaded content'),
                      value: isOffline,
                      onChanged: (value) => OfflineService().setOfflineMode(value),
                    );
                  },
                ),
              ),
              const SizedBox(height: 8),
              Card(
                child: Column(
                  children: [
                    ListTile(
                      leading: const Icon(Icons.download_for_offline_rounded),
                      title: const Text('downloads'),
                      subtitle: const Text('storage usage and auto-download'),
                      trailing: const Icon(Icons.chevron_right_rounded),
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (context) => const DownloadsSettingsPage(),
                          ),
                        );
                      },
                    ),
                    ListTile(
                      leading: Badge(
                        isLabelVisible: _logErrorCount > 0,
                        label: Text(
                          _logErrorCount > 99 ? '99+' : _logErrorCount.toString(),
                        ),
                        backgroundColor: colorScheme.error,
                        textColor: colorScheme.onError,
                        child: const Icon(Icons.settings_suggest_rounded),
                      ),
                      title: const Text('advanced'),
                      subtitle: const Text('backup, playback, and debug tools'),
                      trailing: const Icon(Icons.chevron_right_rounded),
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (context) => const AdvancedSettingsPage(),
                          ),
                        );
                      },
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 8),
              Card(
                child: ListTile(
                  leading: const Icon(Icons.logout_rounded),
                  title: const Text('logout'),
                  subtitle: const Text('sign out of your navidrome server'),
                  onTap: _handleLogout,
                  textColor: colorScheme.error,
                  iconColor: colorScheme.error,
                ),
              ),
              if (_appVersion.isNotEmpty) ...[
                const SizedBox(height: 32),
                Center(
                  child: InkWell(
                    onTap: () => VersionService().showChangelog(context),
                    borderRadius: BorderRadius.circular(16),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 8,
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            Icons.history_rounded,
                            size: 16,
                            color: colorScheme.primary,
                          ),
                          const SizedBox(width: 8),
                          Text(
                            'version $_appVersion',
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: colorScheme.primary,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 100),
              ],
            ],
          ),
        ),
      ],
    );
  }
}
