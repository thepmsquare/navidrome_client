import 'package:flutter/material.dart';
import 'package:navidrome_client/services/api_service.dart';
import 'package:navidrome_client/services/auth_service.dart';
import 'dart:async';
import 'package:navidrome_client/services/player_service.dart';

class SyncPage extends StatefulWidget {
  const SyncPage({super.key});

  @override
  State<SyncPage> createState() => _SyncPageState();
}

class _SyncPageState extends State<SyncPage> {
  ApiService? _apiService;
  List<Map<String, dynamic>> _otherSessions = [];
  bool _isLoading = true;
  String? _currentUsername;
  Timer? _refreshTimer;

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    final auth = AuthService();
    _currentUsername = await auth.username;
    final url = await auth.serverUrl;
    final username = await auth.username;
    final password = await auth.password;

    if (url != null && username != null && password != null) {
      if (mounted) {
        setState(() {
          _apiService = ApiService(
            baseUrl: url,
            username: username,
            password: password,
          );
        });
        _refreshSessions();
        _startRefreshTimer();
      }
    }
  }

  void _startRefreshTimer() {
    _refreshTimer?.cancel();
    _refreshTimer = Timer.periodic(const Duration(seconds: 2), (timer) {
      if (mounted) {
        _refreshSessions(silent: true);
      } else {
        timer.cancel();
      }
    });
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    super.dispose();
  }

  Future<void> _refreshSessions({bool silent = false}) async {
    if (_apiService == null) return;

    if (!silent) {
      setState(() => _isLoading = true);
    }
    
    try {
      final nowPlaying = await _apiService!.getNowPlaying();
      if (mounted) {
        setState(() {
          // keep only this user's sessions from other clients
          _otherSessions = nowPlaying
              .where(
                (e) =>
                    e['username'] == _currentUsername &&
                    e['playerName']?.toString() != 'navidrome_flutter',
              )
              .toList();
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _syncWithSession(Map<String, dynamic> session) async {
    if (_apiService == null) return;

    try {
      final sessionTrackId = session['id']?.toString();
      int? targetPositionMs;

      // 1. Try to get position from session directly (OpenSubsonic extension)
      if (session['positionMs'] != null) {
        targetPositionMs = session['positionMs'] as int;
      }

      // 2. Try to get queue and position from server
      final queueData = await _apiService!.getPlayQueue();
      final entries = queueData['entry'];
      final serverCurrentId = queueData['current']?.toString();
      
      List<Map<String, dynamic>> queue = [session];
      int index = 0;

      if (serverCurrentId == sessionTrackId && entries != null) {
        // server queue matches the session track, use it!
        if (entries is Map) {
          queue = [Map<String, dynamic>.from(entries)];
        } else {
          queue = List<Map<String, dynamic>>.from(entries);
        }
        index = queue.indexWhere((t) => t['id']?.toString() == sessionTrackId);
        if (index == -1) index = 0;
        
        // prefer server-reported position if we don't have one yet
        targetPositionMs ??= queueData['position'] as int?;
      }

      // 3. Final fallback: minutesAgo
      if (targetPositionMs == null || targetPositionMs == 0) {
        final minutesAgo = (session['minutesAgo'] as num?)?.toDouble() ?? 0;
        targetPositionMs = (minutesAgo * 60 * 1000).round();
      }

      await PlayerService().play(queue, index, _apiService!);
      if (targetPositionMs != null && targetPositionMs > 0) {
        await PlayerService().seek(Duration(milliseconds: targetPositionMs));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('failed to sync: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Column(
      children: [
        AppBar(
          title: const Text('sync'),
          automaticallyImplyLeading: false,
          actions: [
            IconButton(
              icon: const Icon(Icons.refresh_rounded),
              onPressed: _refreshSessions,
            ),
          ],
        ),
        Expanded(
          child: RefreshIndicator(
            onRefresh: _refreshSessions,
            child: _isLoading && _otherSessions.isEmpty
                ? const Center(child: CircularProgressIndicator())
                : _otherSessions.isEmpty
                    ? _buildEmptyState(theme)
                    : _buildSessionsList(theme),
          ),
        ),
      ],
    );
  }

  Widget _buildEmptyState(ThemeData theme) {
    return ListView(
      children: [
        SizedBox(height: MediaQuery.of(context).size.height * 0.2),
        Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: theme.colorScheme.secondaryContainer,
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  Icons.devices_other_rounded,
                  size: 48,
                  color: theme.colorScheme.onSecondaryContainer,
                ),
              ),
              const SizedBox(height: 24),
              Text(
                'no other active devices',
                style: theme.textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 8),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 48),
                child: Text(
                  'start playing music on another device to sync your playback here.',
                  textAlign: TextAlign.center,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildSessionsList(ThemeData theme) {
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _otherSessions.length,
      itemBuilder: (context, index) {
        final session = _otherSessions[index];
        final coverArtId = session['coverArt']?.toString();
        final coverArtUrl = coverArtId != null && _apiService != null
            ? _apiService!.getCoverArtUrl(coverArtId)
            : null;

        return Card(
          margin: const EdgeInsets.only(bottom: 12),
          child: ListTile(
            contentPadding: const EdgeInsets.all(12),
            leading: ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: coverArtUrl != null
                  ? Image.network(
                      coverArtUrl,
                      width: 56,
                      height: 56,
                      fit: BoxFit.cover,
                      errorBuilder: (context, error, stackTrace) => _buildFallbackIcon(theme),
                    )
                  : _buildFallbackIcon(theme),
            ),
            title: Text(
              session['title']?.toString() ?? 'unknown track',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontWeight: FontWeight.bold),
            ),
            subtitle: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  session['artist']?.toString() ?? 'unknown artist',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    Icon(Icons.smartphone_rounded, size: 14, color: theme.colorScheme.primary),
                    const SizedBox(width: 4),
                    Expanded(
                      child: Text(
                        session['playerName']?.toString() ?? 'unknown device',
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: theme.colorScheme.primary,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
            trailing: FilledButton.tonalIcon(
              onPressed: () => _syncWithSession(session),
              icon: const Icon(Icons.sync_rounded, size: 18),
              label: const Text('sync'),
            ),
          ),
        );
      },
    );
  }

  Widget _buildFallbackIcon(ThemeData theme) {
    return Container(
      width: 56,
      height: 56,
      color: theme.colorScheme.surfaceContainerHighest,
      child: Icon(Icons.music_note_rounded, color: theme.colorScheme.primary),
    );
  }
}
