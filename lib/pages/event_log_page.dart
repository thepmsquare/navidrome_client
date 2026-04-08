import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:navidrome_client/services/event_log_service.dart';

class EventLogPage extends StatefulWidget {
  const EventLogPage({super.key});

  @override
  State<EventLogPage> createState() => _EventLogPageState();
}

class _EventLogPageState extends State<EventLogPage> {
  final _log = EventLogService();

  @override
  void initState() {
    super.initState();
    _log.changeNotifier.addListener(_onLogChanged);
  }

  @override
  void dispose() {
    _log.changeNotifier.removeListener(_onLogChanged);
    super.dispose();
  }

  void _onLogChanged() {
    if (mounted) setState(() {});
  }

  Future<void> _copyAll() async {
    final text = _log.exportPlainText();
    if (text.isEmpty) return;
    await Clipboard.setData(ClipboardData(text: text));
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('log copied to clipboard')),
      );
    }
  }

  void _clear() {
    _log.clear();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final entries = _log.entries;

    return Scaffold(
      backgroundColor: colorScheme.surface,
      appBar: AppBar(
        title: const Text('event log'),
        backgroundColor: Colors.transparent,
        elevation: 0,
        actions: [
          if (entries.isNotEmpty) ...[
            IconButton(
              icon: const Icon(Icons.copy_all_rounded),
              tooltip: 'copy all',
              onPressed: _copyAll,
            ),
            IconButton(
              icon: const Icon(Icons.delete_sweep_rounded),
              tooltip: 'clear log',
              onPressed: _clear,
            ),
          ],
        ],
      ),
      body: entries.isEmpty
          ? _buildEmpty(theme, colorScheme)
          : _buildLogList(entries, theme, colorScheme),
    );
  }

  Widget _buildEmpty(ThemeData theme, ColorScheme colorScheme) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.task_alt_rounded,
            size: 72,
            color: colorScheme.primary.withValues(alpha: 0.35),
          ),
          const SizedBox(height: 16),
          Text(
            'no events yet',
            style: theme.textTheme.titleMedium?.copyWith(
              color: colorScheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'events will appear here as you use the app',
            style: theme.textTheme.bodySmall?.copyWith(
              color: colorScheme.onSurfaceVariant.withValues(alpha: 0.7),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLogList(
    List<EventLogEntry> entries,
    ThemeData theme,
    ColorScheme colorScheme,
  ) {
    return ListView.builder(
      padding: const EdgeInsets.only(top: 8, bottom: 32, left: 12, right: 12),
      itemCount: entries.length,
      itemBuilder: (context, index) => _EntryCard(
        entry: entries[index],
        theme: theme,
        colorScheme: colorScheme,
      ),
    );
  }
}

class _EntryCard extends StatelessWidget {
  final EventLogEntry entry;
  final ThemeData theme;
  final ColorScheme colorScheme;

  const _EntryCard({
    required this.entry,
    required this.theme,
    required this.colorScheme,
  });

  @override
  Widget build(BuildContext context) {
    final (chipColor, chipTextColor, borderColor) = _levelColors();
    final hasDetails = entry.error != null;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: hasDetails
          ? _buildExpandable(chipColor, chipTextColor, borderColor, context)
          : _buildSimple(chipColor, chipTextColor, borderColor),
    );
  }

  Widget _buildSimple(Color chipColor, Color chipTextColor, Color borderColor) {
    return _CardShell(
      borderColor: borderColor,
      colorScheme: colorScheme,
      child: _buildContent(chipColor, chipTextColor, null),
    );
  }

  Widget _buildExpandable(
    Color chipColor,
    Color chipTextColor,
    Color borderColor,
    BuildContext context,
  ) {
    return _CardShell(
      borderColor: borderColor,
      colorScheme: colorScheme,
      child: ExpansionTile(
        tilePadding: EdgeInsets.zero,
        childrenPadding: const EdgeInsets.only(bottom: 12),
        title: _buildContent(chipColor, chipTextColor, Icons.expand_more_rounded),
        expandedCrossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (entry.error != null)
            _buildDetailBlock('error', entry.error!, Colors.red.shade300),
          if (entry.stackTrace != null)
            _buildDetailBlock('stack trace', entry.stackTrace!, Colors.orange.shade300),
        ],
      ),
    );
  }

  Widget _buildContent(Color chipColor, Color chipTextColor, IconData? trailingIcon) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Level chip
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
          decoration: BoxDecoration(
            color: chipColor,
            borderRadius: BorderRadius.circular(6),
          ),
          child: Text(
            entry.levelLabel,
            style: TextStyle(
              color: chipTextColor,
              fontSize: 10,
              fontWeight: FontWeight.bold,
              letterSpacing: 0.5,
            ),
          ),
        ),
        const SizedBox(width: 10),
        // Message + timestamp
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                entry.message,
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: colorScheme.onSurface,
                  height: 1.3,
                ),
              ),
              const SizedBox(height: 3),
              Text(
                _formatTimestamp(entry.timestamp),
                style: theme.textTheme.labelSmall?.copyWith(
                  color: colorScheme.onSurfaceVariant.withValues(alpha: 0.6),
                  fontFeatures: const [FontFeature.tabularFigures()],
                ),
              ),
            ],
          ),
        ),
        if (trailingIcon != null)
          Icon(trailingIcon, size: 18, color: colorScheme.onSurfaceVariant),
      ],
    );
  }

  Widget _buildDetailBlock(String label, String content, Color labelColor) {
    return Padding(
      padding: const EdgeInsets.only(top: 8, left: 4, right: 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.bold,
              color: labelColor,
              letterSpacing: 0.4,
            ),
          ),
          const SizedBox(height: 4),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: Colors.black.withValues(alpha: 0.25),
              borderRadius: BorderRadius.circular(8),
            ),
            child: SelectableText(
              content,
              style: const TextStyle(
                fontFamily: 'monospace',
                fontSize: 11,
                color: Color(0xFFE0E0E0),
                height: 1.4,
              ),
            ),
          ),
        ],
      ),
    );
  }

  (Color, Color, Color) _levelColors() {
    return switch (entry.level) {
      EventLogLevel.debug => (
          const Color(0xFF37474F),
          const Color(0xFFB0BEC5),
          const Color(0xFF546E7A),
        ),
      EventLogLevel.info => (
          const Color(0xFF1565C0),
          const Color(0xFFE3F2FD),
          const Color(0xFF1976D2),
        ),
      EventLogLevel.warning => (
          const Color(0xFFE65100),
          const Color(0xFFFFF3E0),
          const Color(0xFFF57C00),
        ),
      EventLogLevel.error => (
          const Color(0xFFB71C1C),
          const Color(0xFFFFEBEE),
          const Color(0xFFC62828),
        ),
    };
  }

  String _formatTimestamp(DateTime dt) {
    final h = dt.hour.toString().padLeft(2, '0');
    final m = dt.minute.toString().padLeft(2, '0');
    final s = dt.second.toString().padLeft(2, '0');
    final ms = dt.millisecond.toString().padLeft(3, '0');
    return '$h:$m:$s.$ms';
  }
}

class _CardShell extends StatelessWidget {
  final Color borderColor;
  final ColorScheme colorScheme;
  final Widget child;

  const _CardShell({
    required this.borderColor,
    required this.colorScheme,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: colorScheme.surfaceContainerLow,
        borderRadius: BorderRadius.circular(12),
        border: Border(
          left: BorderSide(color: borderColor, width: 3),
        ),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      child: child,
    );
  }
}
