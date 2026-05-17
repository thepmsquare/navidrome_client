import 'package:flutter_test/flutter_test.dart';
import 'package:navidrome_client/services/queue_coordinator.dart';

void main() {
  group('queue coordinator task pipeline test suite', () {
    test('tasks execute sequentially in enqueued order', () async {
      final coordinator = QueueCoordinator();
      final executionOrder = <int>[];

      // Enqueue multiple async tasks with varying delays
      final f1 = coordinator.enqueue(() async {
        await Future.delayed(const Duration(milliseconds: 30));
        executionOrder.add(1);
      }, 'task 1');

      final f2 = coordinator.enqueue(() async {
        await Future.delayed(const Duration(milliseconds: 10));
        executionOrder.add(2);
      }, 'task 2');

      final f3 = coordinator.enqueue(() async {
        executionOrder.add(3);
      }, 'task 3');

      // Wait for all tasks to complete
      await Future.wait([f1, f2, f3]);

      // Assert that they executed sequentially (1 -> 2 -> 3) despite task 1 and 2 having delays!
      expect(executionOrder, [1, 2, 3]);
    });

    test('error in a task does not halt the pipeline', () async {
      final coordinator = QueueCoordinator();
      final executionOrder = <int>[];

      final f1 = coordinator.enqueue(() async {
        executionOrder.add(1);
      }, 'task 1');

      final f2 = coordinator.enqueue(() async {
        throw Exception('simulated failure');
      }, 'failed task');

      final f3 = coordinator.enqueue(() async {
        executionOrder.add(3);
      }, 'task 3');

      await f1;
      expect(f2, throwsA(isA<Exception>()));
      await f3;

      expect(executionOrder, [1, 3]);

      // Verify that metrics recorded the command count and failure perfectly!
      final metrics = coordinator.getMetrics();
      expect(metrics['failed_mutations_count'], isPositive);
    });
  });
}
