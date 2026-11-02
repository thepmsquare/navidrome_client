package expo.modules.legacyprefs

import android.content.Context
import android.util.Log
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONArray

/**
 * read only access to the android shared preferences written by the legacy flutter app.
 *
 * the legacy app used `shared_preferences`, which stores every key in the
 * `FlutterSharedPreferences` file with a `flutter.` prefix. newer shared_preferences
 * versions can also target the default `<applicationId>_preferences` file, so both
 * forms are read here.
 *
 * keys mirror `lib/services/auth_service.dart` and `lib/services/session_service.dart`
 * from the last flutter release (`1.3.2+24`).
 */
class LegacyPrefsModule : Module() {
  companion object {
    const val TAG = "LegacyPrefsModule"

    private const val FLUTTER_KEY_PREFIX = "flutter."

    /** `shared_preferences` json list marker, see `jsonListPrefix` in shared_preferences_android. */
    private const val JSON_LIST_PREFIX = "VGhpcyBpcyB0aGUgcHJlZml4IGZvciBhIGxpc3Qu!"

    private val KNOWN_KEYS = listOf(
      "server_url",
      "alternate_server_urls",
      "username",
      "password",
      "is_logged_in",
      "stop_playback_on_task_removed",
      "auto_save_offline_played",
      "auto_save_offline_max_bytes",
      "auto_save_offline_lru_evict",
      "home_sections"
    )
  }

  override fun definition() = ModuleDefinition {
    Name("LegacyPrefs")

    AsyncFunction("read") { fileName: String ->
      readPreferences(fileName)
    }
  }

  private fun readPreferences(fileName: String): Map<String, Any?> {
    val context = appContext.reactContext
    if (context == null) {
      Log.w(TAG, "react context is unavailable, cannot read $fileName")
      return emptySnapshot()
    }

    val values: Map<String, *> = try {
      context.getSharedPreferences(fileName, Context.MODE_PRIVATE).all
    } catch (e: Exception) {
      Log.w(TAG, "failed to read shared preferences file $fileName", e)
      return emptySnapshot()
    }

    val found = KNOWN_KEYS.any { key ->
      values.containsKey(key) || values.containsKey(FLUTTER_KEY_PREFIX + key)
    }
    if (!found) {
      return emptySnapshot()
    }

    return mapOf(
      "found" to true,
      "serverUrl" to readString(values, "server_url"),
      "alternateServerUrls" to readStringList(values, "alternate_server_urls"),
      "username" to readString(values, "username"),
      "password" to readString(values, "password"),
      "isLoggedIn" to readBoolean(values, "is_logged_in"),
      "stopPlaybackOnTaskRemoved" to readBoolean(values, "stop_playback_on_task_removed"),
      "autoSaveOfflinePlayed" to readBoolean(values, "auto_save_offline_played"),
      "autoSaveOfflineMaxBytes" to readLong(values, "auto_save_offline_max_bytes"),
      "autoSaveOfflineLruEvict" to readBoolean(values, "auto_save_offline_lru_evict"),
      "homeSections" to readString(values, "home_sections")
    )
  }

  private fun readValue(values: Map<String, *>, key: String): Any? {
    return values[FLUTTER_KEY_PREFIX + key] ?: values[key]
  }

  private fun readString(values: Map<String, *>, key: String): String? {
    return readValue(values, key) as? String
  }

  private fun readBoolean(values: Map<String, *>, key: String): Boolean? {
    return readValue(values, key) as? Boolean
  }

  private fun readLong(values: Map<String, *>, key: String): Long? {
    return when (val raw = readValue(values, key)) {
      is Long -> raw
      is Int -> raw.toLong()
      is String -> raw.toLongOrNull()
      else -> null
    }
  }

  private fun readStringList(values: Map<String, *>, key: String): List<String> {
    return when (val raw = readValue(values, key)) {
      is Set<*> -> raw.filterIsInstance<String>()
      is List<*> -> raw.filterIsInstance<String>()
      is String -> decodeJsonStringList(raw)
      else -> emptyList()
    }
  }

  private fun decodeJsonStringList(raw: String): List<String> {
    if (!raw.startsWith(JSON_LIST_PREFIX)) {
      Log.w(TAG, "skipping string list with unsupported encoding")
      return emptyList()
    }

    return try {
      val array = JSONArray(raw.removePrefix(JSON_LIST_PREFIX))
      List(array.length()) { index -> array.getString(index) }
    } catch (e: Exception) {
      Log.w(TAG, "failed to decode string list", e)
      emptyList()
    }
  }

  private fun emptySnapshot(): Map<String, Any?> {
    return mapOf(
      "found" to false,
      "serverUrl" to null,
      "alternateServerUrls" to emptyList<String>(),
      "username" to null,
      "password" to null,
      "isLoggedIn" to null,
      "stopPlaybackOnTaskRemoved" to null,
      "autoSaveOfflinePlayed" to null,
      "autoSaveOfflineMaxBytes" to null,
      "autoSaveOfflineLruEvict" to null,
      "homeSections" to null
    )
  }
}
