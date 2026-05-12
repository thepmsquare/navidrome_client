import 'package:fuzzy/fuzzy.dart';

class SearchUtils {
  /// performs fuzzy search on a list of items and returns the matching items.
  /// [items] is the list of objects (maps) to search in.
  /// [query] is the search term.
  /// [keys] is the list of keys in the map to use for matching.
  static List<Map<String, dynamic>> fuzzySearch(
    List<Map<String, dynamic>> items,
    String query, {
    required List<String> keys,
  }) {
    if (query.isEmpty) return items;

    final fuse = Fuzzy<Map<String, dynamic>>(
      items,
      options: FuzzyOptions(
        findAllMatches: true,
        threshold: 0.4, // decent balance for typos
        keys: keys.map((key) => WeightedKey<Map<String, dynamic>>(
              name: key,
              getter: (item) => item[key]?.toString() ?? '',
              weight: 1.0,
            )).toList(),
      ),
    );

    final results = fuse.search(query);
    return results.map((r) => r.item).toList();
  }

  /// re-ranks existing results based on fuzzy relevance to the query.
  static List<Map<String, dynamic>> reRank(
    List<Map<String, dynamic>> items,
    String query, {
    required List<String> keys,
  }) {
    if (query.isEmpty || items.isEmpty) return items;

    // fuzzy search on the already filtered items to sort them by relevance
    return fuzzySearch(items, query, keys: keys);
  }
}
