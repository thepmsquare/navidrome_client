import 'dart:async';
import 'package:navidrome_client/services/event_log_service.dart';

class QueueCoordinator {
  static final QueueCoordinator _instance = QueueCoordinator._internal();
  factory QueueCoordinator() => _instance;
  QueueCoordinator._internal();

  final _log = EventLogService();

  // Sequential task chain. Each new task is appended to this future.
  Future<void> _taskChain = Future.value();

  // Metrics for observability
  int _rebuildCount = 0;
  int _divergenceCount = 0;
  int _failedMutationsCount = 0;
  int _commandCount = 0;

  /// Enqueues a task to run sequentially in our single-worker pipeline.
  /// Resolves completing futures and handles errors without breaking the chain.
  Future<T> enqueue<T>(Future<T> Function() task, String commandName) {
    final completer = Completer<T>();
    _commandCount++;
    final startTime = DateTime.now();

    _log.log('coordinator: enqueued command "$commandName" (queue depth metrics)', level: EventLogLevel.debug);

    _taskChain = _taskChain.then((_) async {
      try {
        final result = await task();
        final duration = DateTime.now().difference(startTime);
        _log.log(
          'coordinator: successfully processed "$commandName" in ${duration.inMilliseconds}ms',
          level: EventLogLevel.info,
        );
        completer.complete(result);
      } catch (e, st) {
        _failedMutationsCount++;
        _log.log(
          'coordinator: failed processing "$commandName"',
          level: EventLogLevel.error,
          error: e,
          stackTrace: st,
        );
        completer.completeError(e, st);
      }
    });

    return completer.future;
  }

  /// Increments the count of clean native player rebuilds.
  void recordRebuild() {
    _rebuildCount++;
  }

  /// Increments the count of index desync/divergence events detected.
  void recordDivergence() {
    _divergenceCount++;
  }

  /// Returns a snapshot of coordinator performance metrics for observability.
  Map<String, dynamic> getMetrics() {
    return {
      'rebuild_count': _rebuildCount,
      'divergence_count': _divergenceCount,
      'failed_mutations_count': _failedMutationsCount,
      'command_count': _commandCount,
    };
  }
}
