import 'package:flutter/foundation.dart';

enum EventLogLevel { debug, info, warning, error }

class EventLogEntry {
  final DateTime timestamp;
  final EventLogLevel level;
  final String message;
  final String? error;
  final String? stackTrace;

  const EventLogEntry({
    required this.timestamp,
    required this.level,
    required this.message,
    this.error,
    this.stackTrace,
  });

  String get levelLabel => level.name.toUpperCase();

  String toPlainText() {
    final ts = _formatTimestamp(timestamp);
    final base = '[$ts] [${levelLabel.padRight(7)}] $message';
    if (error != null) {
      return stackTrace != null ? '$base\n  error: $error\n  stack: $stackTrace' : '$base\n  error: $error';
    }
    return base;
  }

  static String _formatTimestamp(DateTime dt) {
    final h = dt.hour.toString().padLeft(2, '0');
    final m = dt.minute.toString().padLeft(2, '0');
    final s = dt.second.toString().padLeft(2, '0');
    final ms = dt.millisecond.toString().padLeft(3, '0');
    return '$h:$m:$s.$ms';
  }
}

class EventLogService {
  static const int _maxEntries = 500;

  static final EventLogService _instance = EventLogService._internal();
  factory EventLogService() => _instance;
  EventLogService._internal();

  final List<EventLogEntry> _entries = [];

  /// Increments each time a new entry is added or the log is cleared.
  final ValueNotifier<int> changeNotifier = ValueNotifier(0);

  /// Returns entries newest-first.
  List<EventLogEntry> get entries => List.unmodifiable(_entries.reversed.toList());

  int get errorCount => _entries.where((e) => e.level == EventLogLevel.error).length;

  void log(
    String message, {
    EventLogLevel level = EventLogLevel.info,
    Object? error,
    StackTrace? stackTrace,
  }) {
    if (_entries.length >= _maxEntries) {
      _entries.removeAt(0);
    }
    _entries.add(EventLogEntry(
      timestamp: DateTime.now(),
      level: level,
      message: message,
      error: error?.toString(),
      stackTrace: stackTrace?.toString(),
    ));
    changeNotifier.value++;
    // Mirror to flutter debug console so developer tools also capture it
    debugPrint('[EventLog][${level.name.toUpperCase()}] $message${error != null ? ' | $error' : ''}');
  }

  void clear() {
    _entries.clear();
    changeNotifier.value++;
  }

  String exportPlainText() => _entries.reversed.map((e) => e.toPlainText()).join('\n');
}
