import 'package:flutter/material.dart';
import 'package:navidrome_client/services/offline_service.dart';

class OfflineIndicator extends StatefulWidget {
  const OfflineIndicator({super.key});

  @override
  State<OfflineIndicator> createState() => _OfflineIndicatorState();
}

class _OfflineIndicatorState extends State<OfflineIndicator> {
  bool _isRetrying = false;

  Future<void> _retry() async {
    if (_isRetrying) return;
    setState(() => _isRetrying = true);
    await OfflineService().retryConnection();
    if (mounted) setState(() => _isRetrying = false);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return ValueListenableBuilder<OfflineState>(
      valueListenable: OfflineService().offlineModeNotifier,
      builder: (context, state, child) {
        if (state == OfflineState.online) return const SizedBox.shrink();

        final bool isNoInternet = state == OfflineState.offlineNoInternet;
        final Color backgroundColor = isNoInternet
            ? colorScheme.errorContainer
            : colorScheme.tertiaryContainer;
        final Color foregroundColor = isNoInternet
            ? colorScheme.onErrorContainer
            : colorScheme.onTertiaryContainer;
        final IconData icon = isNoInternet
            ? Icons.wifi_off_rounded
            : Icons.cloud_off_rounded;
        final String label = isNoInternet
            ? 'no internet'
            : 'offline mode';

        return SafeArea(
          bottom: false,
          child: GestureDetector(
            onTap: isNoInternet ? _retry : null,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 300),
              curve: Curves.easeInOutExpo, // expressive curve
              height: 32,
              color: backgroundColor,
              width: double.infinity,
              child: Center(
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      icon,
                      size: 14,
                      color: foregroundColor,
                    ),
                    const SizedBox(width: 8),
                    Text(
                      label,
                      style: theme.textTheme.labelMedium?.copyWith(
                        color: foregroundColor,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 1.1,
                      ),
                    ),
                    if (isNoInternet) ...[
                      const SizedBox(width: 8),
                      _isRetrying
                          ? SizedBox(
                              width: 12,
                              height: 12,
                              child: CircularProgressIndicator(
                                strokeWidth: 1.5,
                                color: foregroundColor,
                              ),
                            )
                          : Icon(
                              Icons.refresh_rounded,
                              size: 16,
                              color: foregroundColor,
                            ),
                    ],
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}
