import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter/foundation.dart';
import 'package:navidrome_client/utils/subsonic_utils.dart';

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
  })  : _baseUrl = baseUrl.endsWith('/') ? baseUrl.substring(0, baseUrl.length - 1) : baseUrl,
        _username = username,
        _password = password;

  String _buildUrl(String method, Map<String, String> params, {bool includeFormat = true}) {
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
    return _buildUrl('getCoverArt', {'id': id, 'size': size.toString()}, includeFormat: false);
  }

  Future<void> scrobble(String id, {bool submission = true}) async {
    try {
      await _get('scrobble', {
        'id': id,
        'submission': submission.toString(),
      });
    } catch (e) {
      debugPrint('scrobble failed: $e');
    }
  }

  Future<Map<String, dynamic>> _get(String method, [Map<String, String> params = const {}]) async {
    final url = _buildUrl(method, params);
    final response = await http.get(Uri.parse(url));

    if (response.statusCode == 200) {
      final decoded = jsonDecode(response.body);
      final subsonicResponse = decoded['subsonic-response'];
      if (subsonicResponse['status'] == 'ok') {
        return subsonicResponse;
      } else {
        final error = subsonicResponse['error'];
        throw Exception(error != null ? '${error['message']} (code ${error['code']})' : 'unknown api error');
      }
    } else {
      throw Exception('http error: ${response.statusCode}');
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

  Future<List<Map<String, dynamic>>> getAlbums({int count = 50, int offset = 0}) async {
    final response = await _get('getAlbumList2', {
      'type': 'newest',
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

  Future<List<Map<String, dynamic>>> searchSongs(String query, {int count = 50, int offset = 0}) async {
    final response = await _get('search3', {
      'query': query,
      'songCount': count.toString(),
      'songOffset': offset.toString(),
    });
    
    final searchResult = response['searchResult3'];
    if (searchResult == null) return [];
    
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
}
