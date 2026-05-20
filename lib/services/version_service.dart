import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:navidrome_client/services/session_service.dart';

class ChangelogEntry {
  final String version;
  final String notes;

  const ChangelogEntry({required this.version, required this.notes});
}

class VersionService {
  static final VersionService _instance = VersionService._internal();
  factory VersionService() => _instance;
  VersionService._internal();

  bool _isShowing = false;

  Future<void> checkAndShowGreeting(BuildContext context) async {
    if (_isShowing) return;

    final packageInfo = await PackageInfo.fromPlatform();
    final currentVersion = '${packageInfo.version}+${packageInfo.buildNumber}';

    final sessionService = SessionService();
    final lastVersion = await sessionService.lastVersion;

    if (!context.mounted) return;

    if (lastVersion != null && lastVersion != currentVersion) {
      await showChangelog(context, currentVersion);
    }

    if (lastVersion != currentVersion) {
      await sessionService.setLastVersion(currentVersion);
    }
  }

  Future<void> showChangelog(BuildContext context, [String? version]) async {
    if (_isShowing) return;

    String targetVersion = version ?? '';
    if (targetVersion.isEmpty) {
      final p = await PackageInfo.fromPlatform();
      targetVersion = '${p.version}+${p.buildNumber}';
    }

    _isShowing = true;
    final entries = await getAllChangelogEntries();

    ChangelogEntry? targetEntry;
    final List<ChangelogEntry> previousEntries = [];

    bool foundTarget = false;
    for (var entry in entries) {
      if (entry.version == targetVersion) {
        targetEntry = entry;
        foundTarget = true;
      } else if (foundTarget) {
        previousEntries.add(entry);
      }
    }

    if (targetEntry == null) {
      targetEntry = ChangelogEntry(version: targetVersion, notes: '');
      previousEntries.addAll(entries);
    }

    if (context.mounted) {
      await showDialog(
        context: context,
        builder: (context) => AlertDialog(
          title: Text(
            'app was updated with version number $targetVersion'.toLowerCase(),
          ),
          content: SizedBox(
            width: double.maxFinite,
            child: ConstrainedBox(
              constraints: BoxConstraints(
                maxHeight: MediaQuery.of(context).size.height * 0.28,
              ),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      "what's new:".toLowerCase(),
                      style: const TextStyle(fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 8),
                    if (targetEntry!.notes.isEmpty)
                      Text('bug fixes and performance improvements'.toLowerCase())
                    else
                      MarkdownBody(
                        data: targetEntry.notes.toLowerCase(),
                        shrinkWrap: true,
                      ),
                    if (previousEntries.isNotEmpty) ...[
                      const SizedBox(height: 24),
                      Text(
                        "previous versions:".toLowerCase(),
                        style: const TextStyle(fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 8),
                      ...previousEntries.map((entry) {
                        return ExpansionTile(
                          tilePadding: EdgeInsets.zero,
                          childrenPadding: const EdgeInsets.only(left: 8, bottom: 8),
                          shape: const Border(),
                          collapsedShape: const Border(),
                          title: Text(
                            "version ${entry.version}".toLowerCase(),
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.bold,
                              color: Theme.of(context).colorScheme.primary,
                            ),
                          ),
                          children: [
                            if (entry.notes.isEmpty)
                              Text('bug fixes and performance improvements'.toLowerCase())
                            else
                              MarkdownBody(
                                data: entry.notes.toLowerCase(),
                                shrinkWrap: true,
                              ),
                          ],
                        );
                      }),
                    ],
                  ],
                ),
              ),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: Text('close'.toLowerCase()),
            ),
          ],
        ),
      );
    }
    _isShowing = false;
  }

  Future<List<ChangelogEntry>> getAllChangelogEntries() async {
    try {
      final changelog = await rootBundle.loadString('CHANGELOG.md');
      final lines = changelog.split('\n');
      final List<ChangelogEntry> entries = [];

      String currentVersion = '';
      final StringBuffer buffer = StringBuffer();

      for (var line in lines) {
        if (line.startsWith('## ')) {
          if (currentVersion.isNotEmpty) {
            entries.add(ChangelogEntry(
              version: currentVersion,
              notes: buffer.toString().trim(),
            ));
            buffer.clear();
          }
          currentVersion = line.replaceAll('## ', '').trim();
        } else if (currentVersion.isNotEmpty) {
          buffer.writeln(line);
        }
      }
      if (currentVersion.isNotEmpty) {
        entries.add(ChangelogEntry(
          version: currentVersion,
          notes: buffer.toString().trim(),
        ));
      }
      return entries;
    } catch (e) {
      debugPrint('failed to load changelog: $e');
      return [];
    }
  }
}
