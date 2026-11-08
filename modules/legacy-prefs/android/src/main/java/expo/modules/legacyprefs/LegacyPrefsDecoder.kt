package expo.modules.legacyprefs

import org.json.JSONArray

/**
 * pure decoding of the shared preferences written by the legacy flutter app.
 *
 * `shared_preferences` on android stores every key in `FlutterSharedPreferences`
 * with a `flutter.` prefix, string lists as a JSON string behind a marker, and
 * ints as longs. values that do not match the expected type are skipped so a
 * single corrupt entry cannot break the migration.
 */
internal object LegacyPrefsDecoder {
  const val KEY_PREFIX = "flutter."

  /** see `jsonListPrefix` in shared_preferences_android. */
  private const val JSON_LIST_PREFIX = "VGhpcyBpcyB0aGUgcHJlZml4IGZvciBhIGxpc3Qu!"

  private val STRING_KEYS = listOf(
    "server_url",
    "username",
    "password",
    "home_sections"
  )

  private val BOOLEAN_KEYS = listOf(
    "is_logged_in",
    "stop_playback_on_task_removed",
    "auto_save_offline_played",
    "auto_save_offline_lru_evict",
    // pre-1.1.0 names, before "download" was renamed to "save offline".
    "auto_download_played",
    "auto_download_lru_evict"
  )

  private val LONG_KEYS = listOf(
    "auto_save_offline_max_bytes",
    "auto_download_max_bytes"
  )

  private val LIST_KEYS = listOf("alternate_server_urls")

  /**
   * returns the known keys that were present and decoded, keyed by their
   * prefixed preference name, or null when none of them exist.
   */
  fun decode(
    values: Map<String, *>,
    warn: (String) -> Unit = {}
  ): Map<String, Any?>? {
    val decoded = LinkedHashMap<String, Any?>()

    for (key in STRING_KEYS) {
      val value = readValue(values, key) ?: continue
      if (value is String) {
        decoded[KEY_PREFIX + key] = value
      } else {
        warn("ignoring non-string value for ${KEY_PREFIX + key}")
      }
    }

    for (key in BOOLEAN_KEYS) {
      val value = readValue(values, key) ?: continue
      if (value is Boolean) {
        decoded[KEY_PREFIX + key] = value
      } else {
        warn("ignoring non-boolean value for ${KEY_PREFIX + key}")
      }
    }

    for (key in LONG_KEYS) {
      val value = readValue(values, key) ?: continue
      val longValue = toLong(value)
      if (longValue != null) {
        decoded[KEY_PREFIX + key] = longValue
      } else {
        warn("ignoring non-numeric value for ${KEY_PREFIX + key}")
      }
    }

    for (key in LIST_KEYS) {
      val value = readValue(values, key) ?: continue
      val listValue = toStringList(value)
      if (listValue != null) {
        decoded[KEY_PREFIX + key] = listValue
      } else {
        warn("ignoring unsupported value for ${KEY_PREFIX + key}")
      }
    }

    return decoded.ifEmpty { null }
  }

  private fun readValue(values: Map<String, *>, key: String): Any? {
    return values[KEY_PREFIX + key] ?: values[key]
  }

  private fun toLong(value: Any?): Long? {
    return when (value) {
      is Long -> value
      is Int -> value.toLong()
      is String -> value.toLongOrNull()
      else -> null
    }
  }

  private fun toStringList(value: Any?): List<String>? {
    return when (value) {
      is Set<*> -> value.filterIsInstance<String>()
      is List<*> -> value.filterIsInstance<String>()
      is String -> decodeJsonStringList(value)
      else -> null
    }
  }

  private fun decodeJsonStringList(raw: String): List<String>? {
    if (!raw.startsWith(JSON_LIST_PREFIX)) {
      return null
    }

    return try {
      val array = JSONArray(raw.removePrefix(JSON_LIST_PREFIX))
      List(array.length()) { index -> array.getString(index) }
    } catch (e: Exception) {
      null
    }
  }
}
