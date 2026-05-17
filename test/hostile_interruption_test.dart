import 'package:flutter_test/flutter_test.dart';
import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:navidrome_client/domain/track.dart';
import 'package:navidrome_client/repositories/queue_repository.dart';
import 'package:navidrome_client/services/database/app_database.dart';
import 'package:navidrome_client/services/queue_coordinator.dart';

void main() {
  driftRuntimeOptions.dontWarnAboutMultipleDatabases = true;
  late AppDatabase db;
  late QueueRepository repository;
  late QueueCoordinator coordinator;

  setUp(() {
    db = AppDatabase.testing(NativeDatabase.memory());
    repository = QueueRepository(db: db);
    coordinator = QueueCoordinator();
  });

  tearDown(() async {
    await db.close();
  });

  group('hostile queue interruption and timing test suite', () {
    final track1 = Track(id: 't1', title: 's1', artist: 'a1', album: 'al1', duration: 100);
    final track2 = Track(id: 't2', title: 's2', artist: 'a2', album: 'al2', duration: 200);
    final track3 = Track(id: 't3', title: 's3', artist: 'a3', album: 'al3', duration: 300);

    test('simultaneous background interruption and queue mutation serialization', () async {
      // 1. replace queue
      await coordinator.enqueue(() async {
        await repository.replaceQueue([track1, track2, track3]);
      }, 'initial replace');

      final orderOfExecution = <String>[];

      // Simulate a rapid interruption event task arriving during active mutations
      final f1 = coordinator.enqueue(() async {
        await Future.delayed(const Duration(milliseconds: 20));
        await repository.removeFromQueue(0); // remove index 0
        orderOfExecution.add('remove');
      }, 'remove mutation');

      final f2 = coordinator.enqueue(() async {
        // Simulates audio focus ducking trigger or bluetooth skip click action
        await repository.reorderQueue(0, 1); // reorder
        orderOfExecution.add('reorder');
      }, 'focus/bluetooth reorder interruption');

      await Future.wait([f1, f2]);

      // Verify that they executed sequentially without any concurrent desync
      expect(orderOfExecution, ['remove', 'reorder']);

      final finalQueue = await repository.getQueue();
      expect(finalQueue.length, 2);
    });

    test('rebuild recovery and divergence counter metrics logging', () async {
      final metricsBefore = coordinator.getMetrics();
      final divergenceBefore = metricsBefore['divergence_count'] ?? 0;

      // Trigger manual desync metric increments to test telemetry
      coordinator.recordDivergence();
      coordinator.recordRebuild();

      final metricsAfter = coordinator.getMetrics();
      expect(metricsAfter['divergence_count'], divergenceBefore + 1);
      expect(metricsAfter['rebuild_count'], 1);
    });
  });
}
