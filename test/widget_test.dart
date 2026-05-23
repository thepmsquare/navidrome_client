// widget_test.dart — app-startup smoke test.
// verifies that MyApp builds without throwing when not logged in.
// note: this is intentionally a thin smoke test; platform-plugin-heavy
// widget tests are skipped in CI via the @Skip annotation on any test
// that requires a real device/emulator.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:navidrome_client/main.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  testWidgets('app builds without throwing when not logged in', (WidgetTester tester) async {
    await tester.pumpWidget(const MyApp(isLoggedIn: false));
    // the connect / login screen should appear
    expect(find.byType(MaterialApp), findsOneWidget);
  });
}
