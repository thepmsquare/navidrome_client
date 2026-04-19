import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter/foundation.dart';
import 'package:navidrome_client/utils/subsonic_utils.dart';
import 'package:navidrome_client/services/offline_service.dart';
import 'dart:io';

class ApiService {
  final String _baseUrl;
  final String _username;
  final String _password;
  final String _apiVersion = '1.16.1';
  final String _clientName = 'navidrome_flutter';

  ApiService({
    required String baseUrl,
    required String username,
    required String password,
  }) : _baseUrl = baseUrl.endsWith('/')
           ? baseUrl.substring(0, baseUrl.length - 1)
           : baseUrl,
       _username = username,
       _password = password;

  String _buildUrl(
    String method,
    Map<String, String> params, {
    bool includeFormat = true,
  }) {
    final salt = SubsonicUtils.generateSalt();
    final token = SubsonicUtils.generateToken(_password, salt);

    final Map<String, String> queryParams = {
      'u': _username,
      't': token,
      's': salt,
      'v': _apiVersion,
      'c': _clientName,
      if (includeFormat) 'f': 'json',
      ...params,
    };

    final queryString = Uri(queryParameters: queryParams).query;
    return '$_baseUrl/rest/$method.view?$queryString';
  }

  String getStreamUrl(String id) {
    return _buildUrl('stream', {'id': id}, includeFormat: false);
  }

  String getCoverArtUrl(String id, {int size = 160}) {
    return _buildUrl('getCoverArt', {
      'id': id,
      'size': size.toString(),
    }, includeFormat: false);
  }

  Future<void> scrobble(String id, {bool submission = true}) async {
    try {
      await _get('scrobble', {'id': id, 'submission': submission.toString()});
    } catch (e) {
      debugPrint('scrobble failed: $e');
    }
  }

  Future<Map<String, dynamic>?> getLyrics(String artist, String title) async {
    try {
      final response = await _get('getLyrics', {
        'artist': artist,
        'title': title,
      });
      final lyrics = response['lyrics'];
      if (lyrics == null) return null;
      if (lyrics is Map) return Map<String, dynamic>.from(lyrics);
      if (lyrics is List && lyrics.isNotEmpty) return Map<String, dynamic>.from(lyrics.first);
      return null;
    } catch (e) {
      debugPrint('getLyrics failed: $e');
      return null;
    }
  }

  Future<void> setRating(String id, int rating) async {
    try {
      await _get('setRating', {'id': id, 'rating': rating.toString()});
    } catch (e) {
      debugPrint('setRating failed: $e');
    }
  }

  Future<void> star(String id) async {
    try {
      await _get('star', {'id': id});
    } catch (e) {
      debugPrint('star failed: $e');
    }
  }

  Future<void> unstar(String id) async {
    try {
      await _get('unstar', {'id': id});
    } catch (e) {
      debugPrint('unstar failed: $e');
    }
  }

  Future<Map<String, dynamic>> _get(
    String method, [
    Map<String, String> params = const {},
  ]) async {
    final url = _buildUrl(method, params);

    try {
      final response = await http.get(Uri.parse(url));

      if (response.statusCode == 200) {
        final decoded = jsonDecode(response.body);
        final subsonicResponse = decoded['subsonic-response'];
        if (subsonicResponse['status'] == 'ok') {
          return subsonicResponse;
        } else {
          final error = subsonicResponse['error'];
          throw Exception(
            error != null
                ? '${error['message']} (code ${error['code']})'
                : 'unknown api error',
          );
        }
      } else {
        throw Exception('http error: ${response.statusCode}');
      }
    } on SocketException {
      OfflineService().triggerOfflineAutoToggle();
      rethrow;
    } catch (e) {
      final errorStr = e.toString();
      if (errorStr.contains('Failed host lookup') ||
          errorStr.contains('Connection failed') ||
          errorStr.contains('Network is unreachable')) {
        OfflineService().triggerOfflineAutoToggle();
      }
      rethrow;
    }
  }

  Future<bool> ping() async {
    try {
      await _get('ping');
      return true;
    } catch (e) {
      rethrow;
    }
  }

  Future<List<Map<String, dynamic>>> getAlbums({
    String type = 'newest',
    int count = 50,
    int offset = 0,
  }) async {
    final response = await _get('getAlbumList2', {
      'type': type,
      'size': count.toString(),
      'offset': offset.toString(),
    });

    final albumList = response['albumList2'];
    if (albumList == null) return [];

    final albums = albumList['album'];
    if (albums == null) return [];

    if (albums is Map) {
      return [Map<String, dynamic>.from(albums)];
    }

    return List<Map<String, dynamic>>.from(albums);
  }

  Future<List<Map<String, dynamic>>> getTracks(String albumId) async {
    final response = await _get('getMusicDirectory', {'id': albumId});

    final directory = response['directory'];
    if (directory == null) return [];

    final children = directory['child'];
    if (children == null) return [];

    if (children is Map) {
      return [Map<String, dynamic>.from(children)];
    }

    return List<Map<String, dynamic>>.from(children);
  }

  Future<List<Map<String, dynamic>>> searchAlbums(
    String query, {
    int count = 50,
    int offset = 0,
  }) async {
    final response = await _get('search3', {
      'query': query,
      'albumCount': count.toString(),
      'albumOffset': offset.toString(),
    });

    final searchResult = response['searchResult3'];
    if (searchResult == null) return [];

    final albums = searchResult['album'];
    if (albums == null) return [];

    if (albums is Map) {
      return [Map<String, dynamic>.from(albums)];
    }

    return List<Map<String, dynamic>>.from(albums);
  }

  Future<List<Map<String, dynamic>>> getPlaylists() async {
    final response = await _get('getPlaylists');

    final playlistList = response['playlists'];
    if (playlistList == null) return [];

    final playlists = playlistList['playlist'];
    if (playlists == null) return [];

    if (playlists is Map) {
      return [Map<String, dynamic>.from(playlists)];
    }

    return List<Map<String, dynamic>>.from(playlists);
  }

  Future<List<Map<String, dynamic>>> getPlaylistTracks(String id) async {
    final response = await _get('getPlaylist', {'id': id});

    final playlist = response['playlist'];
    if (playlist == null) return [];

    final children = playlist['entry'];
    if (children == null) return [];

    if (children is Map) {
      return [Map<String, dynamic>.from(children)];
    }

    return List<Map<String, dynamic>>.from(children);
  }

  Future<List<Map<String, dynamic>>> searchSongs(
    String query, {
    int count = 50,
    int offset = 0,
  }) async {
    final response = await _get('search3', {
      'query': query,
      'songCount': count.toString(),
      'songOffset': offset.toString(),
    });

    final searchResult = response['searchResult3'];
    if (searchResult == null) {
      if (query == '*') {
        return searchSongs('', count: count, offset: offset);
      }
      return [];
    }

    final songs = searchResult['song'];
    if (songs == null) {
      if (query == '*') {
        return searchSongs('', count: count, offset: offset);
      }
      return [];
    }

    if (songs is Map) {
      return [Map<String, dynamic>.from(songs)];
    }

    return List<Map<String, dynamic>>.from(songs);
  }

  Future<Map<String, List<Map<String, dynamic>>>> searchAll(
    String query, {
    int count = 20,
  }) async {
    final response = await _get('search3', {
      'query': query,
      'artistCount': count.toString(),
      'albumCount': count.toString(),
      'songCount': count.toString(),
    });

    final searchResult = response['searchResult3'] ?? {};

    List<Map<String, dynamic>> artists = [];
    if (searchResult['artist'] != null) {
      if (searchResult['artist'] is Map) {
        artists = [Map<String, dynamic>.from(searchResult['artist'])];
      } else {
        artists = List<Map<String, dynamic>>.from(searchResult['artist']);
      }
    }

    List<Map<String, dynamic>> albums = [];
    if (searchResult['album'] != null) {
      if (searchResult['album'] is Map) {
        albums = [Map<String, dynamic>.from(searchResult['album'])];
      } else {
        albums = List<Map<String, dynamic>>.from(searchResult['album']);
      }
    }

    List<Map<String, dynamic>> songs = [];
    if (searchResult['song'] != null) {
      if (searchResult['song'] is Map) {
        songs = [Map<String, dynamic>.from(searchResult['song'])];
      } else {
        songs = List<Map<String, dynamic>>.from(searchResult['song']);
      }
    }

    return {'artists': artists, 'albums': albums, 'songs': songs};
  }

  Future<List<Map<String, dynamic>>> getRandomSongs({int count = 10}) async {
    final response = await _get('getRandomSongs', {'size': count.toString()});

    final randomSongs = response['randomSongs'];
    if (randomSongs == null) return [];

    final songs = randomSongs['song'];
    if (songs == null) return [];

    if (songs is Map) {
      return [Map<String, dynamic>.from(songs)];
    }

    return List<Map<String, dynamic>>.from(songs);
  }

  Future<List<Map<String, dynamic>>> getSongList({
    int count = 50,
    int offset = 0,
    String? orderBy,
    String? orderDirection,
  }) async {
    final response = await _get('getSongList', {
      'size': count.toString(),
      'offset': offset.toString(),
      if (orderBy != null) 'orderBy': orderBy,
      if (orderDirection != null) 'orderDirection': orderDirection,
    });

    final songList = response['songList'];
    if (songList == null) return [];

    final songs = songList['song'];
    if (songs == null) return [];

    if (songs is Map) {
      return [Map<String, dynamic>.from(songs)];
    }

    return List<Map<String, dynamic>>.from(songs);
  }
}
