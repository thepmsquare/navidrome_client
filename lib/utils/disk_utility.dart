import 'dart:io';
import 'package:path_provider/path_provider.dart';
import 'package:flutter/foundation.dart';

class DiskUtility {
  static Future<int> getDirectorySize(Directory directory) async {
    int totalSize = 0;
    try {
      if (await directory.exists()) {
        await for (var entity in directory.list(recursive: true, followLinks: false)) {
          if (entity is File) {
            totalSize += await entity.length();
          }
        }
      }
    } catch (e) {
      debugPrint('Error calculating directory size for ${directory.path}: $e');
    }
    return totalSize;
  }

  static Future<int> getOfflineSize() async {
    try {
      Directory baseDir;
      if (Platform.isWindows || Platform.isMacOS || Platform.isLinux) {
        baseDir = await getApplicationSupportDirectory();
      } else {
        baseDir = await getApplicationDocumentsDirectory();
      }
      final offlineDir = Directory('${baseDir.path}/offline');
      return await getDirectorySize(offlineDir);
    } catch (e) {
      debugPrint('Error getting offline size: $e');
      return 0;
    }
  }

  static String formatBytes(int bytes) {
    if (bytes <= 0) return '0 b';
    const suffixes = ['b', 'kb', 'mb', 'gb', 'tb'];
    var i = 0;
    double size = bytes.toDouble();
    while (size >= 1024 && i < suffixes.length - 1) {
      size /= 1024;
      i++;
    }
    return '${size.toStringAsFixed(1)} ${suffixes[i]}';
  }
}
