import 'package:flutter_test/flutter_test.dart';
import 'package:navidrome_client/domain/track.dart';

void main() {
  group('track domain model tests', () {
    test('track parsing from standard subsonic json maps', () {
      final json = {
        'id': 'uuid-123',
        'title': 'test title',
        'artist': 'test artist',
        'album': 'test album',
        'duration': 240,
        'coverArt': 'cover-123',
        'starred': '2026-05-17t11:23:32z',
        'rating': 5,
      };

      final track = Track.fromJson(json);
      expect(track.id, 'uuid-123');
      expect(track.title, 'test title');
      expect(track.artist, 'test artist');
      expect(track.album, 'test album');
      expect(track.duration, 240);
      expect(track.coverArt, 'cover-123');
      expect(track.starred, true);
      expect(track.rating, 5);
    });

    test('track parsing with integer ids and coverart', () {
      final json = {
        'id': 12345,
        'title': 'test title',
        'artist': 'test artist',
        'album': 'test album',
        'duration': 180.5,
        'coverArt': 99999,
        'starred': false,
        'rating': '3',
      };

      final track = Track.fromJson(json);
      expect(track.id, '12345');
      expect(track.coverArt, '99999');
      expect(track.duration, 180);
      expect(track.starred, false);
      expect(track.rating, 3);
    });

    test('track parsing with missing optional fields', () {
      final json = {
        'id': 'uuid-456',
      };

      final track = Track.fromJson(json);
      expect(track.id, 'uuid-456');
      expect(track.title, 'unknown track');
      expect(track.artist, 'unknown artist');
      expect(track.album, 'unknown album');
      expect(track.duration, 0);
      expect(track.coverArt, isNull);
      expect(track.starred, false);
      expect(track.rating, 0);
    });

    test('track semantic identity serialization loop', () {
      final json = {
        'id': 'uuid-789',
        'title': 'identity test',
        'artist': 'identity artist',
        'album': 'identity album',
        'duration': 300,
        'coverArt': 'cover-789',
        'rating': 4,
      };

      final track = Track.fromJson(json);
      final serialized = track.toJson();
      final reconstructed = Track.fromJson(serialized);

      expect(reconstructed.id, track.id);
      expect(reconstructed.title, track.title);
      expect(reconstructed.artist, track.artist);
      expect(reconstructed.album, track.album);
      expect(reconstructed.duration, track.duration);
      expect(reconstructed.coverArt, track.coverArt);
      expect(reconstructed.rating, track.rating);
    });
  });
}
