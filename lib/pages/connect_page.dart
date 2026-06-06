import 'package:flutter/material.dart';

import '../constants.dart';

class MyConnectPage extends StatefulWidget {
  const MyConnectPage({super.key});

  @override
  State<MyConnectPage> createState() => _ConnectPageState();
}

class _ConnectPageState extends State<MyConnectPage> {
  bool _isPasswordVisible = false;
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(8.0, 24.0, 8.0, 24.0),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 600),
              child: Column(
                children: [
                  Image.asset(
                    'assets/branding/transparent_icon.png',
                    height: 120,
                    color: colorScheme.primary,
                    colorBlendMode: BlendMode.srcIn,
                  ),
                  Text(AppConstants.appTitle, style: theme.textTheme.bodyLarge),
                  Card(
                    child: Column(
                      children: [
                        Text(
                          "connect to your server",
                          style: theme.textTheme.bodyMedium,
                        ),
                        Form(
                          child: Column(
                            children: [
                              TextFormField(
                                decoration: InputDecoration(
                                  labelText: "server url",
                                  hintText: 'https://demo.navidrome.org',
                                  prefixIcon: const Icon(Icons.dns_rounded),
                                ),
                                keyboardType: TextInputType.url,
                                textInputAction: TextInputAction.next,
                              ),
                              TextFormField(
                                decoration: const InputDecoration(
                                  labelText: 'username',
                                  prefixIcon: Icon(Icons.person_rounded),
                                ),
                              ),
                              TextFormField(
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
                                        _isPasswordVisible =
                                            !_isPasswordVisible;
                                      });
                                    },
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
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
