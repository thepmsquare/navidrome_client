import 'package:flutter/material.dart';
import 'package:navidrome_client/services/session_service.dart';
import 'package:navidrome_client/services/offline_service.dart';

class HomePageSettingsPage extends StatefulWidget {
  const HomePageSettingsPage({super.key});

  @override
  State<HomePageSettingsPage> createState() => _HomePageSettingsPageState();
}

class _HomePageSettingsPageState extends State<HomePageSettingsPage> {
  final _sessionService = SessionService();
  List<Map<String, dynamic>> _sections = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadSettings();
  }

  Future<void> _loadSettings() async {
    final sections = await _sessionService.homeSections;
    if (mounted) {
      setState(() {
        _sections = List<Map<String, dynamic>>.from(sections);
        _isLoading = false;
      });
    }
  }

  Future<void> _saveSettings() async {
    await _sessionService.setHomeSections(_sections);
  }

  String _getSectionLabel(String id) {
    switch (id) {
      case 'most_played':
        return 'most played';
      case 'random_tracks':
        return 'random tracks';
      case 'recently_played':
        return 'recently played';
      case 'random_albums':
        return 'random albums';
      case 'newly_added_releases':
        return 'newly added releases';
      default:
        return id;
    }
  }

  IconData _getSectionIcon(String id) {
    switch (id) {
      case 'most_played':
        return Icons.history_rounded;
      case 'random_tracks':
        return Icons.shuffle_rounded;
      case 'recently_played':
        return Icons.history_rounded;
      case 'random_albums':
        return Icons.album_rounded;
      case 'newly_added_releases':
        return Icons.new_releases_rounded;
      default:
        return Icons.drag_handle_rounded;
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
          appBar: AppBar(title: const Text('home page'), primary: !isOffline),
          body: _isLoading
              ? const Center(child: CircularProgressIndicator())
              : ReorderableListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: _sections.length,
                  // ignore: deprecated_member_use
                  onReorder: (oldIndex, newIndex) {
                    setState(() {
                      if (oldIndex < newIndex) {
                        newIndex -= 1;
                      }
                      final item = _sections.removeAt(oldIndex);
                      _sections.insert(newIndex, item);
                    });
                    _saveSettings();
                  },
                  itemBuilder: (context, index) {
                    final section = _sections[index];
                    final id = section['id'] as String;
                    final isVisible = section['visible'] as bool;

                    return Card(
                      key: ValueKey(id),
                      margin: const EdgeInsets.only(bottom: 8),
                      child: ListTile(
                        leading: Icon(
                          _getSectionIcon(id),
                          color: isVisible
                              ? colorScheme.primary
                              : colorScheme.outline,
                        ),
                        title: Text(
                          _getSectionLabel(id),
                          style: TextStyle(
                            color: isVisible
                                ? colorScheme.onSurface
                                // ignore: deprecated_member_use
                                : colorScheme.onSurface.withOpacity(0.5),
                            fontWeight: isVisible
                                ? FontWeight.bold
                                : FontWeight.normal,
                          ),
                        ),
                        trailing: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Switch(
                              value: isVisible,
                              onChanged: (value) {
                                setState(() {
                                  _sections[index]['visible'] = value;
                                });
                                _saveSettings();
                              },
                            ),
                            const SizedBox(width: 8),
                            ReorderableDragStartListener(
                              index: index,
                              child: const Icon(Icons.drag_handle_rounded),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
          bottomNavigationBar: Padding(
            padding: const EdgeInsets.all(24.0),
            child: Text(
              'drag to rearrange, toggle to hide',
              textAlign: TextAlign.center,
              style: theme.textTheme.bodySmall?.copyWith(
                color: colorScheme.outline,
              ),
            ),
          ),
        );
      },
    );
  }
}
