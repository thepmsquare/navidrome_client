import 'dart:convert';
import 'package:http/http.dart' as http;

import '../models/models.dart';
import '../models/navidrome_credentials.dart';

/// A Flutter service for the Navidrome / Subsonic REST API.
///
/// Navidrome is compatible with Subsonic API v1.16.1.
/// Reference: https://www.navidrome.org/docs/developers/subsonic-api/
///
/// Usage:
/// ```dart
/// final service = NavidromeService(
///   credentials: NavidromeCredentials(
///     serverUrl: 'https://music.example.com',
///     username: 'alice',
///     password: 'secret',
///   ),
/// );
///
/// final artists = await service.getArtists();
/// ```
class NavidromeService {
  final NavidromeCredentials credentials;
  final http.Client _client;

  NavidromeService({
    required this.credentials,
    http.Client? client,
  }) : _client = client ?? http.Client();

  void dispose() => _client.close();

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  Uri _buildUri(String endpoint, [Map<String, String>? extra]) {
    final params = {
      ...credentials.authParams(),
      ...?extra,
    };

    final base = credentials.serverUrl.endsWith('/')
        ? credentials.serverUrl.substring(0, credentials.serverUrl.length - 1)
        : credentials.serverUrl;
    return Uri.parse('$base/rest/$endpoint').replace(queryParameters: params);
  }

  /// Executes a GET request and returns the inner JSON object for [key].
  /// Throws [SubsonicError] on API-level errors, [Exception] on HTTP errors.
  Future<Map<String, dynamic>> _get(
    String endpoint, {
    Map<String, String>? params,
    String? responseKey,
  }) async {
    final uri = _buildUri(endpoint, params);
    final response = await _client.get(uri);

    if (response.statusCode != 200) {
      throw Exception(
        'HTTP ${response.statusCode} for $endpoint',
      );
    }

    final body = jsonDecode(response.body) as Map<String, dynamic>;
    final root = body['subsonic-response'] as Map<String, dynamic>;

    if (root['status'] == 'failed') {
      final err = root['error'] as Map<String, dynamic>;
      throw SubsonicError(
        code: err['code'] as int,
        message: err['message'] as String,
      );
    }

    if (responseKey == null) return root;
    return root[responseKey] as Map<String, dynamic>? ?? {};
  }

  // -------------------------------------------------------------------------
  // System
  // -------------------------------------------------------------------------

  /// Tests connectivity. Returns true on success.
  Future<bool> ping() async {
    try {
      await _get('ping.view');
      return true;
    } catch (_) {
      return false;
    }
  }

  // -------------------------------------------------------------------------
  // Browsing
  // -------------------------------------------------------------------------

  /// Returns all music folders accessible to the authenticated user.
  Future<List<MusicFolder>> getMusicFolders() async {
    final data = await _get('getMusicFolders.view', responseKey: 'musicFolders');
    final raw = data['musicFolder'];
    if (raw == null) return [];
    final list = raw is List ? raw : [raw];
    return list
        .map((e) => MusicFolder.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// Returns all artists, organised by ID3 tags.
  /// [musicFolderId] optionally scopes to one library.
  Future<List<Artist>> getArtists({String? musicFolderId}) async {
    final data = await _get(
      'getArtists.view',
      params: {'musicFolderId': ?musicFolderId},
      responseKey: 'artists',
    );

    final indices = data['index'];
    if (indices == null) return [];
    final indexList = indices is List ? indices : [indices];

    final artists = <Artist>[];
    for (final index in indexList) {
      final raw = index['artist'];
      if (raw == null) continue;
      final artistList = raw is List ? raw : [raw];
      artists.addAll(
        artistList.map((e) => Artist.fromJson(e as Map<String, dynamic>)),
      );
    }
    return artists;
  }

  /// Returns an artist plus their list of albums.
  Future<Artist> getArtist(String id) async {
    final data = await _get(
      'getArtist.view',
      params: {'id': id},
      responseKey: 'artist',
    );
    return Artist.fromJson(data);
  }

  /// Returns an album and its songs.
  Future<Album> getAlbum(String id) async {
    final data = await _get(
      'getAlbum.view',
      params: {'id': id},
      responseKey: 'album',
    );
    return Album.fromJson(data);
  }

  /// Returns the songs for an album (convenience wrapper around [getAlbum]).
  Future<List<Song>> getAlbumSongs(String albumId) async {
    final data = await _get(
      'getAlbum.view',
      params: {'id': albumId},
      responseKey: 'album',
    );
    final raw = data['song'];
    if (raw == null) return [];
    final list = raw is List ? raw : [raw];
    return list.map((e) => Song.fromJson(e as Map<String, dynamic>)).toList();
  }

  /// Returns details for a single song.
  Future<Song> getSong(String id) async {
    final data = await _get(
      'getSong.view',
      params: {'id': id},
      responseKey: 'song',
    );
    return Song.fromJson(data);
  }

  /// Returns all genres in the library.
  Future<List<Genre>> getGenres() async {
    final data = await _get('getGenres.view', responseKey: 'genres');
    final raw = data['genre'];
    if (raw == null) return [];
    final list = raw is List ? raw : [raw];
    return list.map((e) => Genre.fromJson(e as Map<String, dynamic>)).toList();
  }

  // -------------------------------------------------------------------------
  // Album / Song Lists
  // -------------------------------------------------------------------------

  /// Returns a list of albums by [type].
  ///
  /// [type] must be one of: random, newest, frequent, recent, starred,
  /// alphabeticalByName, alphabeticalByArtist, byYear, byGenre.
  ///
  /// Uses the ID3-tag-based getAlbumList2 endpoint.
  Future<List<Album>> getAlbumList({
    String type = 'newest',
    int size = 20,
    int offset = 0,
    int? fromYear,
    int? toYear,
    String? genre,
    String? musicFolderId,
  }) async {
    final data = await _get(
      'getAlbumList2.view',
      params: {
        'type': type,
        'size': size.toString(),
        'offset': offset.toString(),
        'fromYear': ?fromYear?.toString(),
        'toYear': ?toYear?.toString(),
        'genre': ?genre,
        'musicFolderId': ?musicFolderId,
      },
      responseKey: 'albumList2',
    );

    final raw = data['album'];
    if (raw == null) return [];
    final list = raw is List ? raw : [raw];
    return list.map((e) => Album.fromJson(e as Map<String, dynamic>)).toList();
  }

  /// Returns random songs matching optional criteria.
  Future<List<Song>> getRandomSongs({
    int size = 20,
    String? genre,
    int? fromYear,
    int? toYear,
    String? musicFolderId,
  }) async {
    final data = await _get(
      'getRandomSongs.view',
      params: {
        'size': size.toString(),
        'genre': ?genre,
        'fromYear': ?fromYear?.toString(),
        'toYear': ?toYear?.toString(),
        'musicFolderId': ?musicFolderId,
      },
      responseKey: 'randomSongs',
    );

    final raw = data['song'];
    if (raw == null) return [];
    final list = raw is List ? raw : [raw];
    return list.map((e) => Song.fromJson(e as Map<String, dynamic>)).toList();
  }

  /// Returns starred albums, artists and songs for the current user.
  Future<({List<Artist> artists, List<Album> albums, List<Song> songs})>
      getStarred() async {
    final data = await _get('getStarred2.view', responseKey: 'starred2');

    List<T> parse<T>(String key, T Function(Map<String, dynamic>) fromJson) {
      final raw = data[key];
      if (raw == null) return [];
      final list = raw is List ? raw : [raw];
      return list.map((e) => fromJson(e as Map<String, dynamic>)).toList();
    }

    return (
      artists: parse('artist', Artist.fromJson),
      albums: parse('album', Album.fromJson),
      songs: parse('song', Song.fromJson),
    );
  }

  // -------------------------------------------------------------------------
  // Searching
  // -------------------------------------------------------------------------

  /// Searches artists, albums and songs. Uses the ID3-based search3 endpoint.
  Future<SearchResult> search(
    String query, {
    int artistCount = 10,
    int albumCount = 10,
    int songCount = 20,
    String? musicFolderId,
  }) async {
    final data = await _get(
      'search3.view',
      params: {
        'query': query,
        'artistCount': artistCount.toString(),
        'albumCount': albumCount.toString(),
        'songCount': songCount.toString(),
        'musicFolderId': ?musicFolderId,
      },
      responseKey: 'searchResult3',
    );

    List<T> parse<T>(String key, T Function(Map<String, dynamic>) fromJson) {
      final raw = data[key];
      if (raw == null) return [];
      final list = raw is List ? raw : [raw];
      return list.map((e) => fromJson(e as Map<String, dynamic>)).toList();
    }

    return SearchResult(
      artists: parse('artist', Artist.fromJson),
      albums: parse('album', Album.fromJson),
      songs: parse('song', Song.fromJson),
    );
  }

  // -------------------------------------------------------------------------
  // Playlists
  // -------------------------------------------------------------------------

  /// Returns all playlists the user can play.
  Future<List<Playlist>> getPlaylists() async {
    final data = await _get('getPlaylists.view', responseKey: 'playlists');
    final raw = data['playlist'];
    if (raw == null) return [];
    final list = raw is List ? raw : [raw];
    return list
        .map((e) => Playlist.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// Returns a specific playlist with its tracks.
  Future<Playlist> getPlaylist(String id) async {
    final data = await _get(
      'getPlaylist.view',
      params: {'id': id},
      responseKey: 'playlist',
    );
    return Playlist.fromJson(data);
  }

  /// Creates a new playlist. Returns the created [Playlist].
  Future<Playlist> createPlaylist({
    required String name,
    List<String> songIds = const [],
  }) async {
    final data = await _get(
      'createPlaylist.view',
      params: {
        'name': name,
        // Note: multiple songId params aren't supported via a simple Map;
        // see appendSongsToPlaylist() for adding songs after creation.
      },
      responseKey: 'playlist',
    );
    return Playlist.fromJson(data);
  }

  /// Adds songs to an existing playlist.
  Future<void> appendSongsToPlaylist(
    String playlistId,
    List<String> songIds,
  ) async {
    if (songIds.isEmpty) return;

    // Multiple values for the same key require a custom URI build.
    final base = credentials.serverUrl.endsWith('/')
        ? credentials.serverUrl.substring(0, credentials.serverUrl.length - 1)
        : credentials.serverUrl;
    final params = credentials.authParams().entries
        .map((e) => '${Uri.encodeQueryComponent(e.key)}=${Uri.encodeQueryComponent(e.value)}')
        .join('&');
    final songParams =
        songIds.map((id) => 'songIdToAdd=${Uri.encodeQueryComponent(id)}').join('&');

    final uri = Uri.parse(
      '$base/rest/updatePlaylist.view?$params&playlistId=${Uri.encodeQueryComponent(playlistId)}&$songParams',
    );

    final response = await _client.get(uri);
    if (response.statusCode != 200) {
      throw Exception('HTTP ${response.statusCode} updating playlist');
    }

    final body = jsonDecode(response.body) as Map<String, dynamic>;
    final root = body['subsonic-response'] as Map<String, dynamic>;
    if (root['status'] == 'failed') {
      final err = root['error'] as Map<String, dynamic>;
      throw SubsonicError(
        code: err['code'] as int,
        message: err['message'] as String,
      );
    }
  }

  /// Deletes a playlist.
  Future<void> deletePlaylist(String id) async {
    await _get('deletePlaylist.view', params: {'id': id});
  }

  // -------------------------------------------------------------------------
  // Media Retrieval URLs
  // -------------------------------------------------------------------------
  // These return URIs rather than downloading bytes — pass them directly to
  // an audio player (just_audio, audioplayers, etc.) or an Image widget.

  /// Returns the streaming URL for [songId].
  ///
  /// Pass the URI directly to your audio player.
  Uri streamUrl(String songId, {int? maxBitRate, String? format}) {
    return _buildUri('stream.view', {
      'id': songId,
      'maxBitRate': ?maxBitRate?.toString(),
      'format': ?format,
    });
  }

  /// Returns the cover art URL for a song, album, or artist [id].
  Uri coverArtUrl(String id, {int? size}) {
    return _buildUri('getCoverArt.view', {
      'id': id,
      if (size != null) 'size': size.toString(),
    });
  }

  /// Returns the download URL for [songId] (no transcoding).
  Uri downloadUrl(String songId) {
    return _buildUri('download.view', {'id': songId});
  }

  // -------------------------------------------------------------------------
  // Media Annotation
  // -------------------------------------------------------------------------

  /// Stars a song, album, or artist.
  Future<void> star({String? id, String? albumId, String? artistId}) async {
    await _get('star.view', params: {
      'id': ?id,
      'albumId': ?albumId,
      'artistId': ?artistId,
    });
  }

  /// Removes a star from a song, album, or artist.
  Future<void> unstar({String? id, String? albumId, String? artistId}) async {
    await _get('unstar.view', params: {
      'id': ?id,
      'albumId': ?albumId,
      'artistId': ?artistId,
    });
  }

  /// Sets the rating (1–5) for a song / album / artist. Pass 0 to remove.
  Future<void> setRating(String id, int rating) async {
    assert(rating >= 0 && rating <= 5, 'Rating must be 0–5');
    await _get('setRating.view', params: {
      'id': id,
      'rating': rating.toString(),
    });
  }

  /// Scrobbles a song to record playback.
  ///
  /// Set [submission] to false for a "now playing" notification.
  Future<void> scrobble(
    String songId, {
    DateTime? time,
    bool submission = true,
  }) async {
    await _get('scrobble.view', params: {
      'id': songId,
      if (time != null) 'time': time.millisecondsSinceEpoch.toString(),
      'submission': submission.toString(),
    });
  }

  // -------------------------------------------------------------------------
  // Library Scanning (Navidrome extension)
  // -------------------------------------------------------------------------

  /// Returns the current scan status.
  Future<Map<String, dynamic>> getScanStatus() async {
    return _get('getScanStatus.view', responseKey: 'scanStatus');
  }

  /// Triggers a library rescan. Pass [fullScan] = true for a full rescan.
  Future<Map<String, dynamic>> startScan({bool fullScan = false}) async {
    return _get('startScan.view', params: {
      'fullScan': fullScan.toString(),
    }, responseKey: 'scanStatus');
  }
}