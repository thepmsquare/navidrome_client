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

  testWidgets('clearing server url input resets it to https://', (WidgetTester tester) async {
    await tester.pumpWidget(const MyApp(isLoggedIn: false));
    await tester.pumpAndSettle();

    final urlFieldFinder = find.byType(TextField).first;

    // Verify initial URL value is https://
    expect(tester.widget<TextField>(urlFieldFinder).controller?.text, 'https://');
    // Clear button should not be present initially
    expect(find.byTooltip('clear'), findsNothing);

    // Enter a server URL
    await tester.enterText(urlFieldFinder, 'https://demo.navidrome.org');
    await tester.pumpAndSettle();

    // Verify clear button is now visible and URL is updated
    expect(tester.widget<TextField>(urlFieldFinder).controller?.text, 'https://demo.navidrome.org');
    final clearButton = find.byTooltip('clear');
    expect(clearButton, findsOneWidget);

    // Tap the clear button
    await tester.tap(clearButton);
    await tester.pumpAndSettle();

    // Verify text is reset to https:// and clear button is gone
    expect(tester.widget<TextField>(urlFieldFinder).controller?.text, 'https://');
    expect(find.byTooltip('clear'), findsNothing);
  });
}
