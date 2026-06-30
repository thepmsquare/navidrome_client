import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'dart:async';
import 'package:navidrome_client/services/auth_service.dart';
import 'package:navidrome_client/services/api_service.dart';
import 'package:navidrome_client/services/offline_service.dart';

class AlternateUrlsPage extends StatefulWidget {
  const AlternateUrlsPage({super.key});

  @override
  State<AlternateUrlsPage> createState() => _AlternateUrlsPageState();
}

class _AlternateUrlsPageState extends State<AlternateUrlsPage> {
  final _authService = AuthService();
  List<String> _alternateUrls = [];
  final Map<String, bool?> _testResults = {};
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadUrls();
  }

  Future<void> _loadUrls() async {
    final urls = await _authService.alternateServerUrls;
    if (mounted) {
      setState(() {
        _alternateUrls = urls;
        _isLoading = false;
      });
    }
  }

  Future<void> _saveUrls() async {
    await _authService.setAlternateServerUrls(_alternateUrls);
  }

  Future<void> _testConnection(String url) async {
    if (mounted) {
      setState(() {
        _testResults[url] = null; // null indicates loading/testing
      });
    }

    final username = await _authService.username;
    final password = await _authService.password;

    bool success = false;
    if (username != null && password != null) {
      try {
        final cleanUrl = url.trim();
        final baseUrl = cleanUrl.endsWith('/')
            ? cleanUrl.substring(0, cleanUrl.length - 1)
            : cleanUrl;
        final apiService = ApiService(
          baseUrl: baseUrl,
          username: username,
          password: password,
        );
        // timeout of 5 seconds for connection check
        success = await apiService.ping().timeout(const Duration(seconds: 5));
      } catch (_) {
        success = false;
      }
    }

    if (mounted) {
      setState(() {
        _testResults[url] = success;
      });
    }
  }

  void _deleteUrl(String url) async {
    setState(() {
      _alternateUrls.remove(url);
      _testResults.remove(url);
    });
    await _saveUrls();
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('alternate URL removed')),
      );
    }
  }

  Future<void> _showAddUrlDialog() async {
    final formKey = GlobalKey<FormState>();
    final controller = TextEditingController(text: 'https://');
    final pasteFocusNode = FocusNode();

    Future<void> pasteClipboard() async {
      final data = await Clipboard.getData('text/plain');
      if (data?.text != null) {
        controller.text = data!.text!.trim();
        formKey.currentState?.validate();
      }
    }

    final added = await showDialog<String>(
      context: context,
      builder: (context) {
        bool isTesting = false;
        bool? testResult;

        return StatefulBuilder(
          builder: (context, setDialogState) {
            final theme = Theme.of(context);
            final colorScheme = theme.colorScheme;

            Future<void> runDialogTest() async {
              if (!formKey.currentState!.validate()) return;

              setDialogState(() {
                isTesting = true;
                testResult = null;
              });

              final url = controller.text.trim();
              String cleanUrl = url;
              if (!cleanUrl.startsWith('http://') &&
                  !cleanUrl.startsWith('https://')) {
                cleanUrl = 'https://$cleanUrl';
              }

              final username = await _authService.username;
              final password = await _authService.password;

              bool success = false;
              if (username != null && password != null) {
                try {
                  final baseUrl = cleanUrl.endsWith('/')
                      ? cleanUrl.substring(0, cleanUrl.length - 1)
                      : cleanUrl;
                  final apiService = ApiService(
                    baseUrl: baseUrl,
                    username: username,
                    password: password,
                  );
                  success = await apiService.ping().timeout(const Duration(seconds: 5));
                } catch (_) {
                  success = false;
                }
              }

              if (context.mounted) {
                setDialogState(() {
                  isTesting = false;
                  testResult = success;
                });
              }
            }

            return AlertDialog(
              title: const Text('add alternate url'),
              content: Form(
                key: formKey,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    TextFormField(
                      controller: controller,
                      focusNode: pasteFocusNode,
                      decoration: InputDecoration(
                        labelText: 'alternate server url',
                        hintText: 'https://192.168.1.100:4533',
                        prefixIcon: const Icon(Icons.dns_rounded),
                        suffixIcon: IconButton(
                          icon: const Icon(Icons.content_paste_rounded),
                          onPressed: pasteClipboard,
                          tooltip: 'paste',
                        ),
                      ),
                      keyboardType: TextInputType.url,
                      validator: (value) {
                        if (value == null ||
                            value.isEmpty ||
                            value.trim() == 'https://' ||
                            value.trim() == 'http://') {
                          return 'please enter server url';
                        }
                        final urlToValidate = value.trim();
                        final uriString =
                            (urlToValidate.startsWith('http://') ||
                                    urlToValidate.startsWith('https://'))
                                ? urlToValidate
                                : 'https://$urlToValidate';
                        try {
                          final uri = Uri.parse(uriString);
                          if (uri.host.isEmpty ||
                              (!uri.host.contains('.') &&
                                  uri.host != 'localhost') ||
                              urlToValidate.contains(' ')) {
                            return 'invalid url format';
                          }
                        } catch (_) {
                          return 'invalid url format';
                        }
                        return null;
                      },
                    ),
                    if (isTesting || testResult != null) ...[
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          if (isTesting) ...[
                            const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            ),
                            const SizedBox(width: 8),
                            Text(
                              'testing connection...',
                              style: theme.textTheme.bodySmall?.copyWith(
                                color: colorScheme.onSurfaceVariant,
                              ),
                            ),
                          ] else if (testResult == true) ...[
                            const Icon(
                              Icons.check_circle_rounded,
                              color: Colors.green,
                              size: 16,
                            ),
                            const SizedBox(width: 8),
                            Text(
                              'connection successful',
                              style: theme.textTheme.bodySmall?.copyWith(
                                color: Colors.green,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ] else if (testResult == false) ...[
                            Icon(
                              Icons.error_rounded,
                              color: colorScheme.error,
                              size: 16,
                            ),
                            const SizedBox(width: 8),
                            Text(
                              'connection failed',
                              style: theme.textTheme.bodySmall?.copyWith(
                                color: colorScheme.error,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ],
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('cancel'),
                ),
                TextButton(
                  onPressed: isTesting ? null : runDialogTest,
                  child: const Text('test connection'),
                ),
                FilledButton(
                  onPressed: () {
                    if (formKey.currentState!.validate()) {
                      Navigator.pop(context, controller.text.trim());
                    }
                  },
                  child: const Text('add'),
                ),
              ],
            );
          },
        );
      },
    );

    controller.dispose();
    pasteFocusNode.dispose();

    if (added != null && added.isNotEmpty) {
      String cleanUrl = added;
      if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
        cleanUrl = 'https://$cleanUrl';
      }
      if (_alternateUrls.contains(cleanUrl)) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('URL already exists in alternate list')),
          );
        }
        return;
      }
      setState(() {
        _alternateUrls.add(cleanUrl);
      });
      await _saveUrls();
      _testConnection(cleanUrl);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Scaffold(
      appBar: AppBar(
        title: const Text('alternate server urls'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            tooltip: 'test all connections',
            onPressed: _alternateUrls.isEmpty
                ? null
                : () {
                    for (final url in _alternateUrls) {
                      _testConnection(url);
                    }
                  },
          ),
        ],
      ),
      body: ValueListenableBuilder<OfflineState>(
        valueListenable: OfflineService().offlineModeNotifier,
        builder: (context, state, child) {
          if (_isLoading) {
            return const Center(child: CircularProgressIndicator());
          }

          if (_alternateUrls.isEmpty) {
            return Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(24.0),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      Icons.dns_outlined,
                      size: 80,
                      color: colorScheme.secondary.withValues(alpha: 0.4),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      'no alternate URLs',
                      style: theme.textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.bold,
                        color: colorScheme.onSurface,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'configure additional server addresses (e.g. local IPs or home domains) to fall back to when the primary connection is unreachable.',
                      textAlign: TextAlign.center,
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ),
            );
          }

          return ListView.builder(
            padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
            itemCount: _alternateUrls.length,
            itemBuilder: (context, index) {
              final url = _alternateUrls[index];
              final testResult = _testResults[url];

              Widget testStatusIcon;
              String tooltipMsg;
              if (testResult == null && _testResults.containsKey(url)) {
                testStatusIcon = const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2),
                );
                tooltipMsg = 'testing connection...';
              } else if (testResult == true) {
                testStatusIcon = const Icon(
                  Icons.check_circle_rounded,
                  color: Colors.green,
                );
                tooltipMsg = 'connection successful';
              } else if (testResult == false) {
                testStatusIcon = Icon(
                  Icons.error_rounded,
                  color: colorScheme.error,
                );
                tooltipMsg = 'connection failed';
              } else {
                testStatusIcon = const Icon(Icons.play_circle_outline_rounded);
                tooltipMsg = 'test connection';
              }

              return Card(
                margin: const EdgeInsets.symmetric(vertical: 6.0),
                child: ListTile(
                  leading: const Icon(Icons.link_rounded),
                  title: Text(
                    url,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      fontWeight: FontWeight.w500,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Tooltip(
                        message: tooltipMsg,
                        child: IconButton(
                          icon: testStatusIcon,
                          onPressed: (testResult == null &&
                                  _testResults.containsKey(url))
                              ? null
                              : () => _testConnection(url),
                        ),
                      ),
                      IconButton(
                        icon: Icon(
                          Icons.delete_outline_rounded,
                          color: colorScheme.error,
                        ),
                        onPressed: () => _deleteUrl(url),
                        tooltip: 'remove',
                      ),
                    ],
                  ),
                ),
              );
            },
          );
        },
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _showAddUrlDialog,
        icon: const Icon(Icons.add_rounded),
        label: const Text('add URL'),
      ),
    );
  }
}
