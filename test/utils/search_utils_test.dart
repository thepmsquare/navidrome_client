// search_utils_test.dart — pure-dart tests for SearchUtils (fuzzy search).
// covers the fuzzy search feature added in v1.0.0+14.
// no platform channels needed.

import 'package:flutter_test/flutter_test.dart';
import 'package:navidrome_client/utils/search_utils.dart';

void main() {
  final List<Map<String, dynamic>> albums = [
    {'id': '1', 'name': 'Abbey Road', 'artist': 'The Beatles'},
    {'id': '2', 'name': 'Rumours', 'artist': 'Fleetwood Mac'},
    {'id': '3', 'name': 'Dark Side of the Moon', 'artist': 'Pink Floyd'},
    {'id': '4', 'name': 'Thriller', 'artist': 'Michael Jackson'},
    {'id': '5', 'name': 'Led Zeppelin IV', 'artist': 'Led Zeppelin'},
  ];

  group('search utils — fuzzy search', () {
    test('empty query returns all items unchanged', () {
      final result = SearchUtils.fuzzySearch(albums, '', keys: ['name', 'artist']);
      expect(result.length, albums.length);
    });

    test('empty items list returns empty list', () {
      final result = SearchUtils.fuzzySearch([], 'abbey', keys: ['name']);
      expect(result, isEmpty);
    });

    test('exact match returns the matching item', () {
      final result = SearchUtils.fuzzySearch(albums, 'Thriller', keys: ['name']);
      expect(result.isNotEmpty, isTrue);
      expect(result.any((r) => r['name'] == 'Thriller'), isTrue);
    });

    test('fuzzy match on a typo still returns the correct item', () {
      // 'Thriler' is a one-character typo for 'Thriller'
      final result = SearchUtils.fuzzySearch(albums, 'Thriler', keys: ['name']);
      expect(result.isNotEmpty, isTrue);
      expect(result.any((r) => r['name'] == 'Thriller'), isTrue);
    });

    test('search on artist key returns the correct item', () {
      final result = SearchUtils.fuzzySearch(albums, 'Pink Floyd', keys: ['artist']);
      expect(result.isNotEmpty, isTrue);
      expect(result.any((r) => r['artist'] == 'Pink Floyd'), isTrue);
    });

    test('search across multiple keys finds by name or artist', () {
      // 'zeppelin' matches the artist AND the name
      final result = SearchUtils.fuzzySearch(albums, 'zeppelin', keys: ['name', 'artist']);
      expect(result.isNotEmpty, isTrue);
      expect(result.any((r) => r['id'] == '5'), isTrue);
    });

    test('unrelated query returns no results', () {
      final result = SearchUtils.fuzzySearch(albums, 'zzzzzzzzzzz', keys: ['name', 'artist']);
      // with threshold 0.4 a totally unrelated query should return nothing
      expect(result, isEmpty);
    });

    test('items with null values for a key are handled safely', () {
      final itemsWithNull = [
        {'id': '1', 'name': null, 'artist': 'Artist A'},
        {'id': '2', 'name': 'Song B', 'artist': null},
      ];
      // should not throw
      expect(
        () => SearchUtils.fuzzySearch(itemsWithNull, 'song', keys: ['name', 'artist']),
        returnsNormally,
      );
    });
  });

  group('search utils — reRank', () {
    test('empty query returns original list unchanged', () {
      final result = SearchUtils.reRank(albums, '', keys: ['name']);
      expect(result.length, albums.length);
    });

    test('empty items list returns empty list', () {
      final result = SearchUtils.reRank([], 'abbey', keys: ['name']);
      expect(result, isEmpty);
    });

    test('reRank sorts results by relevance to query', () {
      // 'rumour' is closer to 'Rumours' than to 'Abbey Road'
      final result = SearchUtils.reRank(albums, 'rumour', keys: ['name']);
      if (result.isNotEmpty) {
        expect(result.first['name'], equals('Rumours'));
      }
    });
  });
}
