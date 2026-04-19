import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:navidrome_client/services/api_service.dart';

class LyricLine {
  final Duration time;
  final String text;
  LyricLine(this.time, this.text);
}

class LyricsData {
  final String? plain;
  final List<LyricLine>? synced;
  LyricsData({this.plain, this.synced});
  bool get hasSynced => synced != null && synced!.isNotEmpty;
}

class LyricsService {
  final ApiService _apiService;
  final String _lrclibBaseUrl = 'https://lrclib.net/api';

  LyricsService(this._apiService);

  Future<LyricsData?> getLyrics(Map<String, dynamic> track) async {
    final title = (track['title'] ?? '').toString();
    final artist = (track['artist'] ?? '').toString();
    final album = (track['album'] ?? '').toString();
    final duration = (track['duration'] as num?)?.toInt() ?? 0;

    if (title.isEmpty || artist.isEmpty) return null;

    // 1. Try Navidrome
    try {
      final navidromeLyrics = await _apiService.getLyrics(artist, title);
      if (navidromeLyrics != null && navidromeLyrics['value'] != null) {
        final text = navidromeLyrics['value'].toString();
        if (text.trim().isNotEmpty) {
          debugPrint('lyrics found on navidrome');
          // Check if it's LRC format
          if (text.contains('[00:')) {
            return LyricsData(synced: _parseLrc(text));
          }
          return LyricsData(plain: text);
        }
      }
    } catch (e) {
      debugPrint('error fetching lyrics from navidrome: $e');
    }

    // 2. Try LRCLIB
    try {
      return await _fetchFromLrclib(title, artist, album, duration);
    } catch (e) {
      debugPrint('error fetching lyrics from lrclib: $e');
    }

    return null;
  }

  Future<LyricsData?> _fetchFromLrclib(
    String title,
    String artist,
    String album,
    int duration,
  ) async {
    final queryParams = {
      'track_name': title,
      'artist_name': artist,
      'album_name': album,
      'duration': duration.toString(),
    };

    final uri = Uri.parse('$_lrclibBaseUrl/get').replace(queryParameters: queryParams);

    try {
      final response = await http.get(
        uri,
        headers: {
          'User-Agent': 'NavidromeFlutter/1.0.0 (https://github.com/thepmsquare/navidrome_client)',
        },
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final plainLyrics = data['plainLyrics']?.toString();
        final syncedLyrics = data['syncedLyrics']?.toString();
        
        List<LyricLine>? synced;
        if (syncedLyrics != null && syncedLyrics.isNotEmpty) {
          synced = _parseLrc(syncedLyrics);
        }

        return LyricsData(
          plain: plainLyrics,
          synced: synced,
        );
      } else if (response.statusCode == 404) {
        debugPrint('lrclib: lyrics not found for $title - $artist');
      }
    } catch (e) {
      debugPrint('lrclib error: $e');
    }

    return null;
  }

  List<LyricLine> _parseLrc(String lrc) {
    final lines = lrc.split('\n');
    final result = <LyricLine>[];
    // Pattern to match [mm:ss.xx] or [mm:ss.xxx]
    final regExp = RegExp(r'\[(\d+):(\d+\.?\d*)\](.*)');

    for (final line in lines) {
      final match = regExp.firstMatch(line);
      if (match != null) {
        final minutes = int.parse(match.group(1)!);
        final secondsStr = match.group(2)!;
        final seconds = double.parse(secondsStr);
        final text = match.group(3)!.trim();
        
        final time = Duration(
          minutes: minutes,
          seconds: seconds.toInt(),
          milliseconds: ((seconds - seconds.toInt()) * 1000).round(),
        );
        
        // Some LRC files have empty lines for pauses, we keep them for timing
        result.add(LyricLine(time, text));
      }
    }
    
    // Sort by time just in case the LRC is out of order
    result.sort((a, b) => a.time.compareTo(b.time));
    return result;
  }
}
