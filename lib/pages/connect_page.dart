import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:navidrome_client/services/api_service.dart';
import 'package:navidrome_client/services/auth_service.dart';
import 'package:navidrome_client/utils/constants.dart';
import 'package:navidrome_client/services/export_service.dart';
import 'package:navidrome_client/services/offline_service.dart';
import 'package:navidrome_client/services/session_service.dart';

class ConnectPage extends StatefulWidget {
  const ConnectPage({super.key});

  @override
  State<ConnectPage> createState() => _ConnectPageState();
}

class _ConnectPageState extends State<ConnectPage> {
  final _formKey = GlobalKey<FormState>();
  final _urlController = TextEditingController(text: 'https://');
  final _usernameController = TextEditingController();
  final _passwordController = TextEditingController();
  final _authService = AuthService();
  
  final _usernameFocusNode = FocusNode();
  final _passwordFocusNode = FocusNode();
  
  bool _isPasswordVisible = false;
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _urlController.addListener(_onUrlChanged);
  }

  void _onUrlChanged() {
    setState(() {});
  }

  @override
  void dispose() {
    _urlController.dispose();
    _usernameController.dispose();
    _passwordController.dispose();
    _usernameFocusNode.dispose();
    _passwordFocusNode.dispose();
    super.dispose();
  }

  Future<void> _pasteUrl() async {
    final data = await Clipboard.getData('text/plain');
    if (data?.text != null) {
      setState(() {
        _urlController.text = data!.text!;
      });
    }
  }

  Future<void> _handleConnect() async {
    if (_formKey.currentState!.validate()) {
      setState(() {
        _isLoading = true;
      });

      String url = _urlController.text.trim();
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://$url';
      }
      final username = _usernameController.text.trim();
      final password = _passwordController.text.trim();

      try {
        final apiService = ApiService(
          baseUrl: url,
          username: username,
          password: password,
        );

        final success = await apiService.ping();
        if (success) {
          await _authService.saveCredentials(url, username, password);
          if (mounted) {
            Navigator.pushReplacementNamed(context, '/home');
          }
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              // note: we are preserving the original case from the api for error messages.
              content: Text('connection failed: ${e.toString()}'),
              backgroundColor: Theme.of(context).colorScheme.error,
            ),
          );
        }
      } finally {
        if (mounted) {
          setState(() {
            _isLoading = false;
          });
        }
      }
    }
  }

  Future<void> _handleImport() async {
    final data = await ExportService().importSettings();
    if (data != null) {
      if (data['app_identifier'] != 'navidrome_client_backup') {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('invalid backup file')),
          );
        }
        return;
      }

      setState(() {
        if (data['server_url'] != null) _urlController.text = data['server_url'];
        if (data['username'] != null) _usernameController.text = data['username'];
        if (data['password'] != null) _passwordController.text = data['password'];
      });

      // Apply other preferences if present
      if (data['offline_mode'] != null) {
        await OfflineService().setOfflineMode(data['offline_mode'] as bool);
      }
      if (data['stop_playback_on_task_removed'] != null) {
        await SessionService().setStopPlaybackOnTaskRemoved(data['stop_playback_on_task_removed'] as bool);
      }

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('profile imported, connecting...')),
        );
        _handleConnect();
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final size = MediaQuery.of(context).size;
    final isMobile = size.width < 600;

    return Scaffold(
      backgroundColor: colorScheme.surface,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: EdgeInsets.symmetric(
              horizontal: isMobile ? 16.0 : 24.0,
              vertical: 32.0,
            ),
            child: ConstrainedBox(
              constraints: BoxConstraints(
                maxWidth: isMobile ? size.width * 0.95 : 500,
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Image.asset(
                    'assets/branding/transparent_icon.png',
                    height: isMobile ? 80 : 120,
                    color: colorScheme.primary,
                    colorBlendMode: BlendMode.srcIn,
                  ),
                  const SizedBox(height: 16),
                  Text(
                    appDisplayName,
                    textAlign: TextAlign.center,
                    style: (isMobile
                            ? theme.textTheme.displaySmall
                            : theme.textTheme.displayMedium)
                        ?.copyWith(
                      fontWeight: FontWeight.bold,
                      color: colorScheme.primary,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'connect to your server',
                    textAlign: TextAlign.center,
                    style: theme.textTheme.titleMedium?.copyWith(
                      color: colorScheme.onSurfaceVariant,
                    ),
                  ),
                  SizedBox(height: isMobile ? 32 : 48),
                  Card(
                    child: Padding(
                      padding: EdgeInsets.all(isMobile ? 20.0 : 32.0),
                      child: Form(
                        key: _formKey,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            TextFormField(
                              controller: _urlController,
                              enabled: !_isLoading,
                              autofocus: _urlController.text == 'https://',
                              decoration: InputDecoration(
                                labelText: 'server url',
                                hintText: 'https://demo.navidrome.org',
                                prefixIcon: const Icon(Icons.dns_rounded),
                                suffixIcon: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    if (_urlController.text.isNotEmpty &&
                                        _urlController.text != 'https://')
                                      IconButton(
                                        icon: const Icon(Icons.clear_rounded),
                                        onPressed: () => _urlController.clear(),
                                        tooltip: 'clear',
                                      ),
                                    IconButton(
                                      icon: const Icon(Icons.content_paste_rounded),
                                      onPressed: _pasteUrl,
                                      tooltip: 'paste',
                                    ),
                                  ],
                                ),
                              ),
                              keyboardType: TextInputType.url,
                              textInputAction: TextInputAction.next,
                              onFieldSubmitted: (_) =>
                                  FocusScope.of(context).requestFocus(_usernameFocusNode),
                              validator: (value) {
                                if (value == null ||
                                    value.isEmpty ||
                                    value.trim() == 'https://' ||
                                    value.trim() == 'http://') {
                                  return 'please enter server url';
                                }
                                return null;
                              },
                            ),
                            const SizedBox(height: 20),
                            TextFormField(
                              controller: _usernameController,
                              focusNode: _usernameFocusNode,
                              enabled: !_isLoading,
                              decoration: const InputDecoration(
                                labelText: 'username',
                                prefixIcon: Icon(Icons.person_rounded),
                              ),
                              textInputAction: TextInputAction.next,
                              onFieldSubmitted: (_) =>
                                  FocusScope.of(context).requestFocus(_passwordFocusNode),
                              validator: (value) {
                                if (value == null || value.isEmpty) {
                                  return 'please enter username';
                                }
                                return null;
                              },
                            ),
                            const SizedBox(height: 20),
                            TextFormField(
                              controller: _passwordController,
                              focusNode: _passwordFocusNode,
                              enabled: !_isLoading,
                              obscureText: !_isPasswordVisible,
                              decoration: InputDecoration(
                                labelText: 'password',
                                prefixIcon: const Icon(Icons.lock_rounded),
                                suffixIcon: IconButton(
                                  icon: Icon(
                                    _isPasswordVisible
                                        ? Icons.visibility_off_rounded
                                        : Icons.visibility_rounded,
                                  ),
                                  onPressed: () {
                                    setState(() {
                                      _isPasswordVisible = !_isPasswordVisible;
                                    });
                                  },
                                ),
                              ),
                              textInputAction: TextInputAction.done,
                              onFieldSubmitted: (_) => _handleConnect(),
                              validator: (value) {
                                if (value == null || value.isEmpty) {
                                  return 'please enter password';
                                }
                                return null;
                              },
                            ),
                            SizedBox(height: isMobile ? 32 : 40),
                            FilledButton(
                              onPressed: _isLoading ? null : _handleConnect,
                              child: _isLoading
                                  ? const SizedBox(
                                      height: 20,
                                      width: 20,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                        color: Colors.white,
                                      ),
                                    )
                                  : const Text(
                                      'connect',
                                      style: TextStyle(
                                        fontSize: 16,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                            ),
                            const SizedBox(height: 12),
                            TextButton.icon(
                              onPressed: _isLoading ? null : _handleImport,
                              icon: const Icon(Icons.file_open_rounded),
                              label: const Text('import profile'),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
