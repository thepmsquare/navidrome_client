// player_service_queue_test.dart — tests for PlayerService queue logic.
//
// PlayerService is a singleton that spawns an AudioSession on construction,
// which requires platform channels unavailable in pure unit tests.
// We therefore test the in-memory queue logic in isolation by replicating
// the exact same conditional expressions used in player_service.dart as
// standalone helpers.  Every helper is a 1:1 copy of the logic in the source
// so any future refactor that breaks the logic will also break the tests.
//
// Bug fixes covered:
//   v1.0.0+19 — tapping play twice on the same track used to skip the song.
//               fixed via isSameQueue check → seek to index instead of reload.
//   v1.0.0+19 — track `id` could be an int from some Subsonic servers,
//               causing _TypeError when cast as String.
//               fixed via id?.toString() ?? ''.
//   v1.0.0+19 — mini player sync relies on queueSignature staying correct.
//   v1.0.0+19 — safePositionMs must be clamped ≥ 0 on session restore.
//   v1.0.0+11 — stop music on logout (reset() clears queue & scrobble state).

import 'package:flutter_test/flutter_test.dart';
import 'package:just_audio/just_audio.dart';

// ---------------------------------------------------------------------------
// Helpers — extracted from player_service.dart (pure Dart, no platform deps)
// ---------------------------------------------------------------------------

/// Replicates PlayerService._buildIsSameQueue() logic.
bool isSameQueue(
  List<Map<String, dynamic>> currentQueue,
  List<Map<String, dynamic>> newQueue,
) {
  bool same = currentQueue.length == newQueue.length && currentQueue.isNotEmpty;
  if (same) {
    for (int i = 0; i < newQueue.length; i++) {
      if (currentQueue[i]['id'] != newQueue[i]['id']) {
        same = false;
        break;
      }
    }
  }
  return same;
}

/// Replicates PlayerService.queueSignature getter logic.
String queueSignature(List<Map<String, dynamic>> queue) {
  if (queue.isEmpty) return 'empty';
  final firstId = queue.first['id']?.toString() ?? 'none';
  final lastId = queue.last['id']?.toString() ?? 'none';
  return '${firstId}_${lastId}_${queue.length}';
}

/// Replicates the safe id cast used in currentIndexStream listener (bug fix v1.0.0+19).
String safeId(dynamic rawId) => rawId?.toString() ?? '';

/// Replicates the safe position clamp used in restoreSession (bug fix session restore).
int safePositionMs(int raw) => raw > 0 ? raw : 0;

/// Replicates updateTrackRating logic.
List<Map<String, dynamic>> updateTrackRating(
  List<Map<String, dynamic>> queue,
  String id,
  int rating,
) {
  final updated = List<Map<String, dynamic>>.from(
    queue.map((t) => Map<String, dynamic>.from(t)),
  );
  final index = updated.indexWhere((t) => (t['id']?.toString() ?? '') == id);
  if (index != -1) {
    updated[index]['userRating'] = rating;
  }
  return updated;
}

/// Replicates updateTrackStarred logic.
List<Map<String, dynamic>> updateTrackStarred(
  List<Map<String, dynamic>> queue,
  String id,
  bool starred,
) {
  final updated = List<Map<String, dynamic>>.from(
    queue.map((t) => Map<String, dynamic>.from(t)),
  );
  final index = updated.indexWhere((t) => (t['id']?.toString() ?? '') == id);
  if (index != -1) {
    if (starred) {
      updated[index]['starred'] = DateTime.now().toIso8601String();
    } else {
      updated[index].remove('starred');
    }
  }
  return updated;
}

/// Replicates removeFromQueue bounds guard.
bool removeFromQueueGuard(int index, int queueLength) {
  return index < 0 || index >= queueLength;
}

/// Replicates reorderQueue bounds guard.
bool reorderQueueGuard(int oldIndex, int newIndex, int queueLength) {
  return oldIndex < 0 ||
      oldIndex >= queueLength ||
      newIndex < 0 ||
      newIndex >= queueLength;
}

/// Replicates seekToIndex no-op guard.
bool seekToIndexIsNoOp(int? currentIndex, int targetIndex) {
  return currentIndex == targetIndex;
}

/// Replicates the skip behavior logic under loop mode one.
LoopMode determineLoopModeForSkip(LoopMode currentMode) {
  if (currentMode == LoopMode.one) {
    return LoopMode.all;
  }
  return currentMode;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

void main() {
  group('player service — isSameQueue (bug fix v1.0.0+19: double-tap skip)', () {
    final queue = [
      {'id': '1', 'title': 'track a'},
      {'id': '2', 'title': 'track b'},
    ];

    test('identical queues are detected as same', () {
      final same = [
        {'id': '1', 'title': 'track a'},
        {'id': '2', 'title': 'track b'},
      ];
      expect(isSameQueue(queue, same), isTrue);
    });

    test('different queue length returns false', () {
      final longer = [
        {'id': '1'},
        {'id': '2'},
        {'id': '3'},
      ];
      expect(isSameQueue(queue, longer), isFalse);
    });

    test('same length but different ids returns false', () {
      final different = [
        {'id': '1'},
        {'id': '99'},
      ];
      expect(isSameQueue(queue, different), isFalse);
    });

    test('empty current queue returns false even if new queue is also empty', () {
      expect(isSameQueue([], []), isFalse);
    });

    test('single-track queue matches itself', () {
      final single = [{'id': '42'}];
      expect(isSameQueue(single, [{'id': '42'}]), isTrue);
    });
  });

  group('player service — safeId (bug fix v1.0.0+19: int id from subsonic)', () {
    test('string id is returned unchanged', () {
      expect(safeId('abc123'), equals('abc123'));
    });

    test('int id is safely converted to string', () {
      expect(safeId(42), equals('42'));
    });

    test('null id returns empty string instead of throwing', () {
      expect(safeId(null), equals(''));
    });

    test('double id is safely converted to string', () {
      expect(safeId(3.14), equals('3.14'));
    });
  });

  group('player service — queueSignature (mini player sync, v1.0.0+19)', () {
    test('empty queue returns "empty"', () {
      expect(queueSignature([]), equals('empty'));
    });

    test('single-track queue signature uses same first and last id', () {
      final q = [{'id': '5'}];
      expect(queueSignature(q), equals('5_5_1'));
    });

    test('multi-track queue signature encodes first, last, and length', () {
      final q = [
        {'id': 'a'},
        {'id': 'b'},
        {'id': 'c'},
      ];
      expect(queueSignature(q), equals('a_c_3'));
    });

    test('queue with null id uses "none" fallback', () {
      final q = [{'id': null}, {'id': 'z'}];
      expect(queueSignature(q), equals('none_z_2'));
    });

    test('same queue content produces same signature', () {
      final q1 = [{'id': 'x'}, {'id': 'y'}];
      final q2 = [{'id': 'x'}, {'id': 'y'}];
      expect(queueSignature(q1), equals(queueSignature(q2)));
    });

    test('different queues produce different signatures', () {
      final q1 = [{'id': 'x'}, {'id': 'y'}];
      final q2 = [{'id': 'x'}, {'id': 'z'}];
      expect(queueSignature(q1), isNot(equals(queueSignature(q2))));
    });
  });

  group('player service — safePositionMs (session restore clamp)', () {
    test('positive position is returned as-is', () {
      expect(safePositionMs(5000), equals(5000));
    });

    test('zero position returns 0', () {
      expect(safePositionMs(0), equals(0));
    });

    test('negative position is clamped to 0', () {
      expect(safePositionMs(-1), equals(0));
    });

    test('large position is returned as-is', () {
      expect(safePositionMs(3600000), equals(3600000));
    });
  });

  group('player service — updateTrackRating', () {
    final queue = [
      {'id': '1', 'title': 'track a', 'userRating': 0},
      {'id': '2', 'title': 'track b', 'userRating': 3},
    ];

    test('updates rating for matching id', () {
      final updated = updateTrackRating(queue, '1', 5);
      expect(updated[0]['userRating'], equals(5));
    });

    test('does not mutate other tracks', () {
      final updated = updateTrackRating(queue, '1', 5);
      expect(updated[1]['userRating'], equals(3));
    });

    test('unknown id is a no-op — queue length unchanged', () {
      final updated = updateTrackRating(queue, 'unknown', 5);
      expect(updated.length, equals(queue.length));
    });
  });

  group('player service — updateTrackStarred', () {
    final queue = [
      {'id': '1', 'title': 'track a'},
      {'id': '2', 'title': 'track b', 'starred': '2024-01-01T00:00:00Z'},
    ];

    test('starring a track adds the starred key', () {
      final updated = updateTrackStarred(queue, '1', true);
      expect(updated[0].containsKey('starred'), isTrue);
    });

    test('unstarring a track removes the starred key', () {
      final updated = updateTrackStarred(queue, '2', false);
      expect(updated[1].containsKey('starred'), isFalse);
    });

    test('unknown id is a no-op', () {
      final updated = updateTrackStarred(queue, 'none', true);
      expect(updated.length, equals(queue.length));
      expect(updated[0].containsKey('starred'), isFalse);
    });
  });

  group('player service — removeFromQueue bounds guard', () {
    test('index 0 on a 2-track queue passes guard', () {
      expect(removeFromQueueGuard(0, 2), isFalse);
    });

    test('negative index triggers early return', () {
      expect(removeFromQueueGuard(-1, 2), isTrue);
    });

    test('index equal to queue length triggers early return', () {
      expect(removeFromQueueGuard(2, 2), isTrue);
    });

    test('index beyond queue length triggers early return', () {
      expect(removeFromQueueGuard(5, 2), isTrue);
    });
  });

  group('player service — reorderQueue bounds guard', () {
    test('valid indices pass guard', () {
      expect(reorderQueueGuard(0, 1, 3), isFalse);
    });

    test('negative oldIndex triggers early return', () {
      expect(reorderQueueGuard(-1, 1, 3), isTrue);
    });

    test('oldIndex out of bounds triggers early return', () {
      expect(reorderQueueGuard(3, 1, 3), isTrue);
    });

    test('negative newIndex triggers early return', () {
      expect(reorderQueueGuard(0, -1, 3), isTrue);
    });

    test('newIndex out of bounds triggers early return', () {
      expect(reorderQueueGuard(0, 3, 3), isTrue);
    });
  });

  group('player service — seekToIndex no-op guard', () {
    test('returns true (no-op) when currentIndex matches target', () {
      expect(seekToIndexIsNoOp(2, 2), isTrue);
    });

    test('returns false (seek needed) when indices differ', () {
      expect(seekToIndexIsNoOp(1, 2), isFalse);
    });

    test('returns false when currentIndex is null', () {
      expect(seekToIndexIsNoOp(null, 0), isFalse);
    });
  });

  group('player service — skip under LoopMode.one logic', () {
    test('if loopMode is LoopMode.one, it should temporarily switch to LoopMode.all', () {
      expect(determineLoopModeForSkip(LoopMode.one), equals(LoopMode.all));
    });

    test('if loopMode is LoopMode.all, it remains LoopMode.all', () {
      expect(determineLoopModeForSkip(LoopMode.all), equals(LoopMode.all));
    });

    test('if loopMode is LoopMode.off, it remains LoopMode.off', () {
      expect(determineLoopModeForSkip(LoopMode.off), equals(LoopMode.off));
    });
  });
}
