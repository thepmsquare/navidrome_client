import 'dart:convert';
import 'dart:io';
import 'package:file_picker/file_picker.dart';
import 'package:navidrome_client/services/auth_service.dart';
import 'package:navidrome_client/services/offline_service.dart';
import 'package:navidrome_client/services/session_service.dart';

class ExportService {
  static final ExportService _instance = ExportService._internal();
  factory ExportService() => _instance;
  ExportService._internal();

  final _authService = AuthService();
  final _offlineService = OfflineService();
  final _sessionService = SessionService();

  Future<bool> exportSettings() async {
    try {
      final settings = {
        'app_identifier': 'navidrome_client_backup',
        'server_url': await _authService.serverUrl,
        'username': await _authService.username,
        'password': await _authService.password,
        'offline_mode': _offlineService.isOfflineMode,
        'stop_playback_on_task_removed': await _sessionService.stopPlaybackOnTaskRemoved,
        'export_date': DateTime.now().toIso8601String(),
        'version': 1,
      };

      final jsonString = const JsonEncoder.withIndent('  ').convert(settings);
      
      final String? outputFile = await FilePicker.platform.saveFile(
        dialogTitle: 'backup configuration',
        fileName: 'navidrome_backup.json',
        type: FileType.custom,
        allowedExtensions: ['json'],
        bytes: utf8.encode(jsonString),
      );

      if (outputFile != null) {
        // on some platforms saveFile returns the path and we need to write the file ourselves
        // but it usually takes bytes on web/desktop. 
        // for mobile it might just save it directly if bytes are provided.
        // let's check if the file was actually written or if we need to write it.
        final file = File(outputFile);
        if (!await file.exists()) {
          await file.writeAsString(jsonString);
        }
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  Future<Map<String, dynamic>?> importSettings() async {
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['json'],
      );

      if (result != null && result.files.single.path != null) {
        final file = File(result.files.single.path!);
        final content = await file.readAsString();
        final data = jsonDecode(content) as Map<String, dynamic>;
        return data;
      }
    } catch (e) {
      // ignore errors
    }
    return null;
  }
}
