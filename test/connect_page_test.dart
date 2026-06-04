import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:navidrome_client/pages/connect_page.dart';

void main() {
  testWidgets('ConnectPage UI Elements Test', (WidgetTester tester) async {
    // Build the MyConnectPage widget inside a MaterialApp.
    await tester.pumpWidget(
      const MaterialApp(
        home: MyConnectPage(),
      ),
    );

    // Verify that the header text is present.
    expect(find.text('connect to your server'), findsOneWidget);

    // Verify that the input fields are present by their labels/hints.
    expect(find.widgetWithText(TextFormField, 'server url'), findsOneWidget);
    expect(find.widgetWithText(TextFormField, 'username'), findsOneWidget);
    expect(find.widgetWithText(TextFormField, 'password'), findsOneWidget);
  });
}
