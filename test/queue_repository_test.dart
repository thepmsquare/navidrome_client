import 'package:flutter_test/flutter_test.dart';
import 'package:drift/native.dart';
import 'package:navidrome_client/domain/track.dart';
import 'package:navidrome_client/repositories/queue_repository.dart';
import 'package:navidrome_client/services/database/app_database.dart';

void main() {
  late AppDatabase db;
  late QueueRepository repository;

  setUp(() {
    db = AppDatabase.testing(NativeDatabase.memory());
    repository = QueueRepository(db: db);
  });

  tearDown(() async {
    await db.close();
  });

  group('queue repository structural test suite', () {
    final track1 = Track(id: 't1', title: 'song 1', artist: 'art 1', album: 'alb 1', duration: 100);
    final track2 = Track(id: 't2', title: 'song 2', artist: 'art 2', album: 'alb 2', duration: 200);

    test('watchQueue stream only emits structural updates, suppressing duplicates', () async {
      final emissions = <List<Track>>[];
      final subscription = repository.watchQueue().listen(emissions.add);

      // 1. initial state (empty)
      await Future.delayed(Duration.zero);
      expect(emissions.length, 1);
      expect(emissions.first.isEmpty, isTrue);

      // 2. replace queue
      await repository.replaceQueue([track1, track2]);
      await Future.delayed(Duration.zero);
      expect(emissions.length, 2);
      expect(emissions[1].length, 2);
      expect(emissions[1][0].id, 't1');

      // 3. duplicate replace with identical track elements
      await repository.replaceQueue([track1, track2]);
      await Future.delayed(Duration.zero);
      expect(emissions.length, 2); // Still 2! Emission suppressed by distinct structural equality!

      // 4. remove track (structural change)
      await repository.removeFromQueue(0);
      await Future.delayed(Duration.zero);
      expect(emissions.length, 3); // Emitted structural change!
      expect(emissions[2].length, 1);
      expect(emissions[2][0].id, 't2');

      await subscription.cancel();
    });
  });
}
