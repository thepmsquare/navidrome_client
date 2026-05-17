import 'package:collection/collection.dart';
import 'package:navidrome_client/domain/track.dart';
import 'package:navidrome_client/services/database/app_database.dart';

class QueueRepository {
  final AppDatabase _db;

  QueueRepository({AppDatabase? db}) : _db = db ?? AppDatabase();

  /// Watches structural play queue changes.
  /// Uses deep list equality to aggressively suppress duplicate rebuild storms.
  Stream<List<Track>> watchQueue() {
    return _db.watchQueue().map((rows) {
      return rows.map((r) => Track.fromDb(r)).toList();
    }).distinct((prev, next) {
      // structural list equality: suppresses emissions if the length, ids, 
      // or active status of tracks did not actually change.
      return const ListEquality<Track>(_TrackEquality()).equals(prev, next);
    });
  }

  /// Gets the complete play queue list.
  Future<List<Track>> getQueue() async {
    final rows = await _db.getQueue();
    return rows.map((r) => Track.fromDb(r)).toList();
  }

  /// Replaces the active queue transactionally.
  Future<void> replaceQueue(List<Track> queue) async {
    final companions = <PlaybackQueuesCompanion>[];
    for (var i = 0; i < queue.length; i++) {
      companions.add(queue[i].toCompanion(i));
    }
    await _db.replaceQueue(companions);
  }

  /// Appends a new track to the end of the current play queue.
  Future<void> addToQueue(Track track) async {
    final current = await getQueue();
    final nextSortIndex = current.length;
    await _db.into(_db.playbackQueues).insert(track.toCompanion(nextSortIndex));
  }

  /// Removes a track from the queue at a specific index.
  Future<void> removeFromQueue(int index) async {
    await _db.removeFromQueue(index);
  }

  /// Reorders the play queue list elements.
  Future<void> reorderQueue(int oldIndex, int newIndex) async {
    await _db.reorderQueue(oldIndex, newIndex);
  }

  /// Sets the active track within the queue.
  Future<void> setActiveTrack(String trackId) async {
    await _db.setActiveTrack(trackId);
  }
}

/// Helper for structural Track equality to prevent unnecessary stream updates.
class _TrackEquality implements Equality<Track> {
  const _TrackEquality();

  @override
  bool equals(Track e1, Track e2) {
    return e1.id == e2.id && e1.localPath == e2.localPath && e1.starred == e2.starred;
  }

  @override
  int hash(Track e) {
    return Object.hash(e.id, e.localPath, e.starred);
  }

  @override
  bool isValidKey(Object? o) => o is Track;
}
