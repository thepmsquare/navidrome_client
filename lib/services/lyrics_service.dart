import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:navidrome_client/services/api_service.dart';

class LyricsService {
  final ApiService _apiService;
  final String _lrclibBaseUrl = 'https://lrclib.net/api';

  LyricsService(this._apiService);

  Future<String?> getLyrics(Map<String, dynamic> track) async {
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
          return text;
        }
      }
    } catch (e) {
      debugPrint('error fetching lyrics from navidrome: $e');
    }

    // 2. Try LRCLIB
    try {
      final lrclibLyrics = await _fetchFromLrclib(title, artist, album, duration);
      if (lrclibLyrics != null) {
        debugPrint('lyrics found on lrclib');
        return lrclibLyrics;
      }
    } catch (e) {
      debugPrint('error fetching lyrics from lrclib: $e');
    }

    return null;
  }

  Future<String?> _fetchFromLrclib(
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
        // Prefer synced lyrics if available, fallback to plain
        // For now we just return text, we can improve this later to handle LRC
        final plainLyrics = data['plainLyrics']?.toString();
        final syncedLyrics = data['syncedLyrics']?.toString();
        
        // If synced lyrics exist, they usually contain the plain text as well (with timestamps)
        // For simple display, plainLyrics is better if available.
        return (plainLyrics != null && plainLyrics.isNotEmpty) 
            ? plainLyrics 
            : syncedLyrics;
      } else if (response.statusCode == 404) {
        debugPrint('lrclib: lyrics not found for $title - $artist');
      }
    } catch (e) {
      debugPrint('lrclib error: $e');
    }

    return null;
  }
}
