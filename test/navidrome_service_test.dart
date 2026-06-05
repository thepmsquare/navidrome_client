import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:mocktail/mocktail.dart';

import 'package:navidrome_service/navidrome_service.dart';

class MockHttpClient extends Mock implements http.Client {}

// Helper to build a minimal Subsonic JSON envelope
String subsonicOk(Map<String, dynamic> inner) => jsonEncode({
      'subsonic-response': {
        'status': 'ok',
        'version': '1.16.1',
        ...inner,
      }
    });

String subsonicError(int code, String message) => jsonEncode({
      'subsonic-response': {
        'status': 'failed',
        'version': '1.16.1',
        'error': {'code': code, 'message': message},
      }
    });

void main() {
  late MockHttpClient mockClient;
  late NavidromeService service;

  setUp(() {
    mockClient = MockHttpClient();
    service = NavidromeService(
      credentials: const NavidromeCredentials(
        serverUrl: 'https://test.example.com',
        username: 'test',
        password: 'pass',
      ),
      client: mockClient,
    );
    registerFallbackValue(Uri());
  });

  tearDown(() => service.dispose());

  group('ping', () {
    test('returns true on ok response', () async {
      when(() => mockClient.get(any())).thenAnswer(
        (_) async => http.Response(subsonicOk({}), 200),
      );
      expect(await service.ping(), isTrue);
    });

    test('returns false on network error', () async {
      when(() => mockClient.get(any())).thenThrow(Exception('timeout'));
      expect(await service.ping(), isFalse);
    });
  });

  group('getArtists', () {
    test('parses artist list correctly', () async {
      when(() => mockClient.get(any())).thenAnswer(
        (_) async => http.Response(
          subsonicOk({
            'artists': {
              'index': [
                {
                  'name': 'R',
                  'artist': [
                    {'id': 'ar-1', 'name': 'Radiohead', 'albumCount': 9}
                  ]
                }
              ]
            }
          }),
          200,
        ),
      );

      final artists = await service.getArtists();
      expect(artists.length, 1);
      expect(artists.first.name, 'Radiohead');
      expect(artists.first.albumCount, 9);
    });

    test('returns empty list when no artists', () async {
      when(() => mockClient.get(any())).thenAnswer(
        (_) async => http.Response(
          subsonicOk({'artists': {}}),
          200,
        ),
      );
      expect(await service.getArtists(), isEmpty);
    });
  });

  group('search', () {
    test('parses search3 result', () async {
      when(() => mockClient.get(any())).thenAnswer(
        (_) async => http.Response(
          subsonicOk({
            'searchResult3': {
              'artist': [
                {'id': 'ar-1', 'name': 'Radiohead'}
              ],
              'album': [],
              'song': [
                {'id': 's-1', 'title': 'Creep', 'artist': 'Radiohead'}
              ],
            }
          }),
          200,
        ),
      );

      final result = await service.search('radiohead');
      expect(result.artists.length, 1);
      expect(result.songs.length, 1);
      expect(result.songs.first.title, 'Creep');
    });
  });

  group('error handling', () {
    test('throws SubsonicError on API failure', () async {
      when(() => mockClient.get(any())).thenAnswer(
        (_) async => http.Response(subsonicError(70, 'Not found'), 200),
      );

      expect(
        () => service.getSong('bad-id'),
        throwsA(
          isA<SubsonicError>()
              .having((e) => e.code, 'code', 70)
              .having((e) => e.message, 'message', 'Not found'),
        ),
      );
    });
  });

  group('URL helpers', () {
    test('streamUrl contains song id and auth params', () {
      final uri = service.streamUrl('song-123', maxBitRate: 320);
      expect(uri.path, contains('stream.view'));
      expect(uri.queryParameters['id'], 'song-123');
      expect(uri.queryParameters['maxBitRate'], '320');
      expect(uri.queryParameters['u'], 'test');
    });

    test('coverArtUrl contains size param when provided', () {
      final uri = service.coverArtUrl('art-456', size: 512);
      expect(uri.queryParameters['id'], 'art-456');
      expect(uri.queryParameters['size'], '512');
    });
  });
}