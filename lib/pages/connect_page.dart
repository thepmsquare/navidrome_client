import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'dart:async';
import 'package:m3e_collection/m3e_collection.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:navidrome_client/services/api_service.dart';
import 'package:navidrome_client/services/auth_service.dart';
import 'package:navidrome_client/utils/constants.dart';
import 'package:navidrome_client/services/export_service.dart';
import 'package:navidrome_client/services/session_service.dart';
import 'package:navidrome_client/services/version_service.dart';

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
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (!mounted) return;
      final isLoggedIn = await _authService.isLoggedIn;
      if (!mounted) return;
      if (isLoggedIn) {
        Navigator.pushReplacementNamed(context, '/home');
        return;
      }
      VersionService().checkAndShowGreeting(context);
    });
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
        _urlController.text = data!.text!.trim();
      });
      _formKey.currentState?.validate();
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

        final success = await apiService.ping().timeout(
          const Duration(seconds: 10),
          onTimeout: () => throw TimeoutException('connection timeout'),
        );
        if (success) {
          await _authService.saveCredentials(url, username, password);
          _passwordController.clear();
          _usernameController.clear();
          _urlController.text = 'https://';
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
          ScaffoldMessenger.of(
            context,
          ).showSnackBar(const SnackBar(content: Text('invalid backup file')));
        }
        return;
      }

      setState(() {
        if (data['server_url'] != null) {
          _urlController.text = data['server_url'];
        }
        if (data['username'] != null) {
          _usernameController.text = data['username'];
        }
        if (data['password'] != null) {
          _passwordController.text = data['password'];
        }
      });

      // Apply other preferences if present
      if (data['stop_playback_on_task_removed'] != null) {
        await SessionService().setStopPlaybackOnTaskRemoved(
          data['stop_playback_on_task_removed'] as bool,
        );
      }
      if (data['home_sections'] != null) {
        final List<dynamic> homeSections = data['home_sections'];
        await SessionService().setHomeSections(
          homeSections.map((e) => Map<String, dynamic>.from(e as Map)).toList(),
        );
      }

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('profile imported, connecting...')),
        );
        _handleConnect();
      }
    }
  }

  Future<void> _handleDemoMode() async {
    setState(() {
      _urlController.text = 'https://demo.navidrome.org';
      _usernameController.text = 'demo';
      _passwordController.text = 'demo';
    });
    _handleConnect();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final size = MediaQuery.of(context).size;
    final isMobile = size.width < 600;

    return Scaffold(
      backgroundColor: colorScheme.surface,
      appBar: AppBar(
        toolbarHeight: isMobile ? 40 : null,
        backgroundColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        automaticallyImplyLeading: false,
        actions: [
          IconButton(
            icon: const Icon(Icons.help_outline_rounded),
            tooltip: 'help',
            onPressed: () => Navigator.pushNamed(context, '/help'),
          ),
        ],
      ),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: EdgeInsets.symmetric(
              horizontal: isMobile ? 16.0 : 24.0,
              vertical: isMobile ? 12.0 : 32.0,
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
                    height: isMobile ? 96 : 120,
                    color: colorScheme.primary,
                    colorBlendMode: BlendMode.srcIn,
                  ),
                  SizedBox(height: isMobile ? 8 : 16),
                  Text(
                    appDisplayName,
                    textAlign: TextAlign.center,
                    style:
                        (isMobile
                                ? theme.textTheme.displaySmall
                                : theme.textTheme.displayMedium)
                            ?.copyWith(
                              fontWeight: FontWeight.bold,
                              color: colorScheme.primary,
                            ),
                  ),
                  SizedBox(height: isMobile ? 2 : 4),
                  Text(
                    appDisplaySubtitle,
                    textAlign: TextAlign.center,
                    style: theme.textTheme.titleSmall?.copyWith(
                      color: colorScheme.secondary,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  SizedBox(height: isMobile ? 16 : 24),
                  Text(
                    'connect to your server',
                    textAlign: TextAlign.center,
                    style: theme.textTheme.titleMedium?.copyWith(
                      color: colorScheme.onSurfaceVariant,
                    ),
                  ),
                  SizedBox(height: isMobile ? 16 : 40),
                  Card(
                    child: Padding(
                      padding: EdgeInsets.fromLTRB(
                        isMobile ? 16.0 : 24.0,
                        isMobile ? 20.0 : 28.0,
                        isMobile ? 16.0 : 24.0,
                        isMobile ? 20.0 : 28.0,
                      ),
                      child: Form(
                        key: _formKey,
                        child: AutofillGroup(
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
                                  contentPadding: EdgeInsets.symmetric(
                                    vertical: isMobile ? 14.0 : 18.0,
                                    horizontal: isMobile ? 16.0 : 24.0,
                                  ),
                                  suffixIcon: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      if (_urlController.text.isNotEmpty &&
                                          _urlController.text != 'https://')
                                        IconButton(
                                          icon: const Icon(Icons.clear_rounded),
                                          onPressed: () =>
                                              _urlController.text = 'https://',
                                          tooltip: 'clear',
                                        ),
                                      IconButton(
                                        icon: const Icon(
                                          Icons.content_paste_rounded,
                                        ),
                                        onPressed: _pasteUrl,
                                        tooltip: 'paste',
                                      ),
                                    ],
                                  ),
                                ),
                                keyboardType: TextInputType.url,
                                textInputAction: TextInputAction.next,
                                onFieldSubmitted: (_) => FocusScope.of(
                                  context,
                                ).requestFocus(_usernameFocusNode),
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
                              SizedBox(height: isMobile ? 16 : 20),
                              TextFormField(
                                controller: _usernameController,
                                focusNode: _usernameFocusNode,
                                enabled: !_isLoading,
                                autofillHints: const [AutofillHints.username],
                                decoration: InputDecoration(
                                  labelText: 'username',
                                  prefixIcon: const Icon(Icons.person_rounded),
                                  contentPadding: EdgeInsets.symmetric(
                                    vertical: isMobile ? 14.0 : 18.0,
                                    horizontal: isMobile ? 16.0 : 24.0,
                                  ),
                                ),
                                textInputAction: TextInputAction.next,
                                onFieldSubmitted: (_) => FocusScope.of(
                                  context,
                                ).requestFocus(_passwordFocusNode),
                                validator: (value) {
                                  if (value == null || value.isEmpty) {
                                    return 'please enter username';
                                  }
                                  return null;
                                },
                              ),
                              SizedBox(height: isMobile ? 16 : 20),
                              TextFormField(
                                controller: _passwordController,
                                focusNode: _passwordFocusNode,
                                enabled: !_isLoading,
                                obscureText: !_isPasswordVisible,
                                autofillHints: const [AutofillHints.password],
                                decoration: InputDecoration(
                                  labelText: 'password',
                                  prefixIcon: const Icon(Icons.lock_rounded),
                                  contentPadding: EdgeInsets.symmetric(
                                    vertical: isMobile ? 14.0 : 18.0,
                                    horizontal: isMobile ? 16.0 : 24.0,
                                  ),
                                  suffixIcon: IconButton(
                                    icon: Icon(
                                      _isPasswordVisible
                                          ? Icons.visibility_off_rounded
                                          : Icons.visibility_rounded,
                                    ),
                                    onPressed: () {
                                      setState(() {
                                        _isPasswordVisible =
                                            !_isPasswordVisible;
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
                              SizedBox(height: isMobile ? 24 : 40),
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.stretch,
                                children: [
                                  Semantics(
                                    button: true,
                                    enabled: !_isLoading,
                                    label: 'connect to server',
                                    child: ButtonM3E(
                                      onPressed: _isLoading
                                          ? null
                                          : _handleConnect,
                                      style: ButtonM3EStyle.filled,
                                      size: ButtonM3ESize.md,
                                      shape: ButtonM3EShape.round,
                                      label: _isLoading
                                          ? Row(
                                              mainAxisAlignment:
                                                  MainAxisAlignment.center,
                                              mainAxisSize: MainAxisSize.min,
                                              children: [
                                                const SizedBox(
                                                  height: 20,
                                                  width: 20,
                                                  child:
                                                      CircularProgressIndicator(
                                                        strokeWidth: 2,
                                                        color: Colors.white,
                                                      ),
                                                ),
                                                const SizedBox(width: 8),
                                                const Text(
                                                  'connecting...',
                                                  style: TextStyle(
                                                    fontSize: 16,
                                                    fontWeight: FontWeight.bold,
                                                  ),
                                                  overflow:
                                                      TextOverflow.ellipsis,
                                                ),
                                              ],
                                            )
                                          : const Text(
                                              'connect',
                                              style: TextStyle(
                                                fontSize: 16,
                                                fontWeight: FontWeight.bold,
                                              ),
                                            ),
                                    ),
                                  ),
                                  const SizedBox(height: 12),
                                  Semantics(
                                    button: true,
                                    enabled: !_isLoading,
                                    label: 'import profile',
                                    child: TextButton.icon(
                                      onPressed: _isLoading
                                          ? null
                                          : _handleImport,
                                      icon: const Icon(Icons.file_open_rounded),
                                      label: const Text('import profile'),
                                      style: TextButton.styleFrom(
                                        backgroundColor: colorScheme
                                            .secondaryContainer
                                            .withValues(alpha: 0.3),
                                        foregroundColor: colorScheme.secondary,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                  SizedBox(height: isMobile ? 16 : 24),
                  Card(
                    color: colorScheme.secondaryContainer.withValues(
                      alpha: 0.5,
                    ),
                    elevation: 2,
                    child: Padding(
                      padding: EdgeInsets.all(isMobile ? 14.0 : 18.0),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            'new to navidrome?',
                            style: theme.textTheme.titleSmall?.copyWith(
                              color: colorScheme.secondary,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'get started by learning more about the project or visiting the official website.',
                            textAlign: TextAlign.center,
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: colorScheme.onSurfaceVariant,
                            ),
                          ),
                          const SizedBox(height: 12),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Semantics(
                                button: true,
                                label: 'learn more',
                                child: TextButton(
                                  onPressed: () =>
                                      Navigator.pushNamed(context, '/help'),
                                  child: const Text('learn more'),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Semantics(
                                button: true,
                                label: 'visit website',
                                child: TextButton(
                                  onPressed: () async {
                                    final url = Uri.parse(
                                      'https://www.navidrome.org',
                                    );
                                    if (await canLaunchUrl(url)) {
                                      await launchUrl(
                                        url,
                                        mode: LaunchMode.externalApplication,
                                      );
                                    }
                                  },
                                  child: const Text('visit website'),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Semantics(
                            button: true,
                            enabled: !_isLoading,
                            label: 'try demo mode',
                            child: ButtonM3E(
                              onPressed: _isLoading ? null : _handleDemoMode,
                              style: ButtonM3EStyle.tonal,
                              size: ButtonM3ESize.sm,
                              shape: ButtonM3EShape.round,
                              label: const Text('try demo'),
                            ),
                          ),
                        ],
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
