// ---------------------------------------------------------------------------
// Models for Subsonic API responses
// ---------------------------------------------------------------------------
// All models parse from the JSON maps that come back inside
// subsonic-response > [entity] when using f=json.
// ---------------------------------------------------------------------------

class MusicFolder {
  final String id;
  final String name;

  const MusicFolder({required this.id, required this.name});

  factory MusicFolder.fromJson(Map<String, dynamic> json) => MusicFolder(
        id: json['id'].toString(),
        name: json['name'] as String,
      );
}

// ---------------------------------------------------------------------------

class Artist {
  final String id;
  final String name;
  final String? coverArtId;
  final int? albumCount;
  final String? starred; // ISO-8601 date string if starred

  const Artist({
    required this.id,
    required this.name,
    this.coverArtId,
    this.albumCount,
    this.starred,
  });

  factory Artist.fromJson(Map<String, dynamic> json) => Artist(
        id: json['id'].toString(),
        name: json['name'] as String,
        coverArtId: json['coverArt']?.toString(),
        albumCount: json['albumCount'] as int?,
        starred: json['starred'] as String?,
      );
}

// ---------------------------------------------------------------------------

class Album {
  final String id;
  final String name;
  final String? artistId;
  final String? artist;
  final String? coverArtId;
  final int? songCount;
  final int? duration; // seconds
  final int? year;
  final String? genre;
  final String? starred;

  const Album({
    required this.id,
    required this.name,
    this.artistId,
    this.artist,
    this.coverArtId,
    this.songCount,
    this.duration,
    this.year,
    this.genre,
    this.starred,
  });

  factory Album.fromJson(Map<String, dynamic> json) => Album(
        id: json['id'].toString(),
        name: json['name'] as String,
        artistId: json['artistId']?.toString(),
        artist: json['artist'] as String?,
        coverArtId: json['coverArt']?.toString(),
        songCount: json['songCount'] as int?,
        duration: json['duration'] as int?,
        year: json['year'] as int?,
        genre: json['genre'] as String?,
        starred: json['starred'] as String?,
      );
}

// ---------------------------------------------------------------------------

class Song {
  final String id;
  final String title;
  final String? albumId;
  final String? album;
  final String? artistId;
  final String? artist;
  final String? coverArtId;
  final int? duration;   // seconds
  final int? bitRate;    // kbps
  final String? suffix;  // file extension
  final String? contentType;
  final int? size;       // bytes
  final int? track;
  final int? year;
  final String? genre;
  final String? starred;
  final int? userRating; // 1–5

  const Song({
    required this.id,
    required this.title,
    this.albumId,
    this.album,
    this.artistId,
    this.artist,
    this.coverArtId,
    this.duration,
    this.bitRate,
    this.suffix,
    this.contentType,
    this.size,
    this.track,
    this.year,
    this.genre,
    this.starred,
    this.userRating,
  });

  factory Song.fromJson(Map<String, dynamic> json) => Song(
        id: json['id'].toString(),
        title: json['title'] as String,
        albumId: json['albumId']?.toString(),
        album: json['album'] as String?,
        artistId: json['artistId']?.toString(),
        artist: json['artist'] as String?,
        coverArtId: json['coverArt']?.toString(),
        duration: json['duration'] as int?,
        bitRate: json['bitRate'] as int?,
        suffix: json['suffix'] as String?,
        contentType: json['contentType'] as String?,
        size: json['size'] as int?,
        track: json['track'] as int?,
        year: json['year'] as int?,
        genre: json['genre'] as String?,
        starred: json['starred'] as String?,
        userRating: json['userRating'] as int?,
      );
}

// ---------------------------------------------------------------------------

class Playlist {
  final String id;
  final String name;
  final String? comment;
  final String? owner;
  final bool? isPublic;
  final int? songCount;
  final int? duration;
  final String? coverArtId;
  final List<Song> songs;

  const Playlist({
    required this.id,
    required this.name,
    this.comment,
    this.owner,
    this.isPublic,
    this.songCount,
    this.duration,
    this.coverArtId,
    this.songs = const [],
  });

  factory Playlist.fromJson(Map<String, dynamic> json) {
    final entries = json['entry'];
    final songs = entries is List
        ? entries.map((e) => Song.fromJson(e as Map<String, dynamic>)).toList()
        : <Song>[];

    return Playlist(
      id: json['id'].toString(),
      name: json['name'] as String,
      comment: json['comment'] as String?,
      owner: json['owner'] as String?,
      isPublic: json['public'] as bool?,
      songCount: json['songCount'] as int?,
      duration: json['duration'] as int?,
      coverArtId: json['coverArt']?.toString(),
      songs: songs,
    );
  }
}

// ---------------------------------------------------------------------------

class Genre {
  final String value;
  final int songCount;
  final int albumCount;

  const Genre({
    required this.value,
    required this.songCount,
    required this.albumCount,
  });

  factory Genre.fromJson(Map<String, dynamic> json) => Genre(
        value: json['value'] as String,
        songCount: (json['songCount'] as int?) ?? 0,
        albumCount: (json['albumCount'] as int?) ?? 0,
      );
}

// ---------------------------------------------------------------------------

class SearchResult {
  final List<Artist> artists;
  final List<Album> albums;
  final List<Song> songs;

  const SearchResult({
    this.artists = const [],
    this.albums = const [],
    this.songs = const [],
  });
}

// ---------------------------------------------------------------------------

/// Typed error returned by the Subsonic API.
class SubsonicError implements Exception {
  final int code;
  final String message;

  const SubsonicError({required this.code, required this.message});

  @override
  String toString() => 'SubsonicError($code): $message';
}