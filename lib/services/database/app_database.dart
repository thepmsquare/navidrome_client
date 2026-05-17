import 'dart:io';
import 'package:meta/meta.dart';
import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:path_provider/path_provider.dart';
import 'package:path/path.dart' as p;

part 'app_database.g.dart';

class PlaybackQueues extends Table {
  IntColumn get id => integer().autoIncrement()();
  TextColumn get trackId => text()();
  TextColumn get title => text().withDefault(const Constant(''))();
  TextColumn get artist => text().withDefault(const Constant(''))();
  TextColumn get album => text().withDefault(const Constant(''))();
  IntColumn get duration => integer().withDefault(const Constant(0))();
  TextColumn get coverArt => text().nullable()();
  BoolColumn get isStarred => boolean().withDefault(const Constant(false))();
  IntColumn get rating => integer().withDefault(const Constant(0))();
  IntColumn get sortIndex => integer()();
  BoolColumn get isActive => boolean().withDefault(const Constant(false))();
  TextColumn get playbackState => text().withDefault(const Constant('initial'))();
  TextColumn get localPath => text().nullable()();
}

class OfflineAssets extends Table {
  TextColumn get trackId => text()();
  TextColumn get localAudioPath => text().nullable()();
  TextColumn get localCoverPath => text().nullable()();
  TextColumn get localLyricsPath => text().nullable()();
  TextColumn get downloadStatus => text().withDefault(const Constant('pending'))();
  IntColumn get fileSizeBytes => integer().withDefault(const Constant(0))();
  IntColumn get lastAccessedTimestamp => integer().withDefault(const Constant(0))();

  @override
  Set<Column> get primaryKey => {trackId};
}

@DriftDatabase(tables: [PlaybackQueues, OfflineAssets])
class AppDatabase extends _$AppDatabase {
  static final AppDatabase _instance = AppDatabase._internal();
  factory AppDatabase() => _instance;

  AppDatabase._internal() : super(_openConnection());

  @visibleForTesting
  AppDatabase.testing(QueryExecutor executor) : super(executor);

  @override
  int get schemaVersion => 1;

  Stream<List<PlaybackQueue>> watchQueue() {
    return (select(playbackQueues)..orderBy([(t) => OrderingTerm(expression: t.sortIndex)])).watch();
  }

  Future<List<PlaybackQueue>> getQueue() {
    return (select(playbackQueues)..orderBy([(t) => OrderingTerm(expression: t.sortIndex)])).get();
  }

  Future<void> replaceQueue(List<PlaybackQueuesCompanion> companions) async {
    await transaction(() async {
      await delete(playbackQueues).go();
      for (var i = 0; i < companions.length; i++) {
        await into(playbackQueues).insert(companions[i]);
      }
    });
  }

  Future<void> removeFromQueue(int index) async {
    await transaction(() async {
      final targets = await (select(playbackQueues)..where((t) => t.sortIndex.equals(index))).get();
      if (targets.isEmpty) return;

      await (delete(playbackQueues)..where((t) => t.id.equals(targets.first.id))).go();

      final remaining = await (select(playbackQueues)
            ..where((t) => t.sortIndex.isBiggerThanValue(index))
            ..orderBy([(t) => OrderingTerm(expression: t.sortIndex)]))
          .get();

      for (final row in remaining) {
        await (update(playbackQueues)..where((t) => t.id.equals(row.id)))
            .write(PlaybackQueuesCompanion(sortIndex: Value(row.sortIndex - 1)));
      }
    });
  }

  Future<void> reorderQueue(int oldIndex, int newIndex) async {
    await transaction(() async {
      final all = await (select(playbackQueues)..orderBy([(t) => OrderingTerm(expression: t.sortIndex)])).get();
      if (oldIndex < 0 || oldIndex >= all.length || newIndex < 0 || newIndex >= all.length) return;

      final moved = all.removeAt(oldIndex);
      all.insert(newIndex, moved);

      for (var i = 0; i < all.length; i++) {
        await (update(playbackQueues)..where((t) => t.id.equals(all[i].id)))
            .write(PlaybackQueuesCompanion(sortIndex: Value(i)));
      }
    });
  }

  Future<void> setActiveTrack(String trackId) async {
    await transaction(() async {
      await update(playbackQueues).write(const PlaybackQueuesCompanion(isActive: Value(false)));
      await (update(playbackQueues)..where((t) => t.trackId.equals(trackId)))
          .write(const PlaybackQueuesCompanion(isActive: Value(true)));
    });
  }
}

LazyDatabase _openConnection() {
  return LazyDatabase(() async {
    final dbFolder = await getApplicationDocumentsDirectory();
    final file = File(p.join(dbFolder.path, 'app_database.sqlite'));
    return NativeDatabase.createInBackground(file);
  });
}
