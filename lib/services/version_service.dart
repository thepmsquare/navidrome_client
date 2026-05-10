import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:navidrome_client/services/session_service.dart';

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
    final notes = await _getChangelogForVersion(targetVersion);
    if (context.mounted) {
      await showDialog(
        context: context,
        builder: (context) => AlertDialog(
          title: Text(
            'app was updated with version number $targetVersion'.toLowerCase(),
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  "what's new:".toLowerCase(),
                  style: const TextStyle(fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                if (notes.isEmpty)
                  Text('bug fixes and performance improvements'.toLowerCase())
                else
                  MarkdownBody(
                    data: notes.toLowerCase(),
                    shrinkWrap: true,
                  ),
              ],
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

  Future<String> _getChangelogForVersion(String version) async {
    try {
      final changelog = await rootBundle.loadString('CHANGELOG.md');
      final lines = changelog.split('\n');
      final StringBuffer buffer = StringBuffer();
      bool foundVersion = false;

      for (var line in lines) {
        if (line.startsWith('## ') && line.contains(version)) {
          foundVersion = true;
          continue;
        }
        if (foundVersion) {
          if (line.startsWith('## ')) break;
          buffer.writeln(line);
        }
      }
      return buffer.toString().trim();
    } catch (e) {
      debugPrint('failed to load changelog: $e');
      return '';
    }
  }
}
