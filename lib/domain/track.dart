import 'package:drift/drift.dart';
import 'package:navidrome_client/services/database/app_database.dart';

class Track {
  final String id;
  final String title;
  final String artist;
  final String album;
  final int duration;
  final String? coverArt;
  final bool starred;
  final int rating;
  final String? localPath;

  const Track({
    required this.id,
    required this.title,
    required this.artist,
    required this.album,
    required this.duration,
    this.coverArt,
    this.starred = false,
    this.rating = 0,
    this.localPath,
  });

  /// Extremely defensive JSON parser that guarantees standard types and prevents dynamic typing crashes.
  factory Track.fromJson(Map<String, dynamic> json) {
    // Some subsonic servers return starred as a date string if starred, or true/false.
    final starredVal = json['starred'];
    final starredAtVal = json['starredAt'];
    final isStarred = starredVal != null && starredVal != false || starredAtVal != null;

    int parseInt(dynamic value) {
      if (value == null) return 0;
      if (value is num) return value.toInt();
      if (value is String) {
        return int.tryParse(value) ?? double.tryParse(value)?.toInt() ?? 0;
      }
      return 0;
    }

    return Track(
      id: (json['id'] ?? '').toString(),
      title: (json['title'] ?? json['name'] ?? 'unknown track').toString(),
      artist: (json['artist'] ?? 'unknown artist').toString(),
      album: (json['album'] ?? 'unknown album').toString(),
      duration: parseInt(json['duration']),
      coverArt: json['coverArt']?.toString(),
      starred: isStarred,
      rating: parseInt(json['rating']),
      localPath: json['localPath']?.toString(),
    );
  }

  /// Converts a Drift database row back into the clean Track domain model.
  factory Track.fromDb(PlaybackQueue row) {
    return Track(
      id: row.trackId,
      title: row.title,
      artist: row.artist,
      album: row.album,
      duration: row.duration,
      coverArt: row.coverArt,
      starred: row.isStarred,
      rating: row.rating,
      localPath: row.localPath,
    );
  }

  /// Serializes the domain model back into standard Subsonic API JSON map layout.
  /// This maintains backwards compatibility with existing UI components during refactoring.
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'artist': artist,
      'album': album,
      'duration': duration,
      if (coverArt != null) 'coverArt': coverArt,
      if (starred) 'starred': DateTime.now().toIso8601String(),
      'rating': rating,
      if (localPath != null) 'localPath': localPath,
    };
  }

  /// Builds a Companion for transactional SQLite database writes.
  PlaybackQueuesCompanion toCompanion(int sortIndex, {bool isActive = false, String state = 'initial'}) {
    return PlaybackQueuesCompanion.insert(
      trackId: id,
      title: Value(title),
      artist: Value(artist),
      album: Value(album),
      duration: Value(duration),
      coverArt: Value(coverArt),
      isStarred: Value(starred),
      rating: Value(rating),
      sortIndex: sortIndex,
      isActive: Value(isActive),
      playbackState: Value(state),
    );
  }
}
