package expo.modules.legacyprefs

import android.content.Context
import android.util.Log
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

/**
 * read only access to the preferences written by the legacy flutter app.
 *
 * the legacy app used `shared_preferences`, which stores every key in the
 * `FlutterSharedPreferences` file with a `flutter.` prefix. migration code
 * (credentials + settings) reads through this module so it never has to touch
 * the old storage format directly.
 */
class LegacyPrefsModule : Module() {
  companion object {
    const val TAG = "LegacyPrefsModule"
  }

  override fun definition() = ModuleDefinition {
    Name("LegacyPrefs")

    AsyncFunction("read") { fileName: String ->
      readPreferences(fileName)
    }
  }

  /**
   * returns the known legacy keys stored in [fileName], or null when the file
   * does not exist or none of the known keys are usable. throws when the file
   * exists but cannot be read, so the js layer can tell a corrupt store apart
   * from an absent one.
   */
  private fun readPreferences(fileName: String): Map<String, Any?>? {
    val context = appContext.reactContext
    if (context == null) {
      Log.w(TAG, "react context is unavailable, cannot read $fileName")
      return null
    }

    val file = File(context.applicationInfo.dataDir, "shared_prefs/$fileName.xml")
    if (!file.exists()) {
      return null
    }

    val stored = try {
      context.getSharedPreferences(fileName, Context.MODE_PRIVATE).all
    } catch (e: Exception) {
      Log.w(TAG, "failed to read shared preferences file $fileName", e)
      throw e
    }

    return LegacyPrefsDecoder.decode(stored) { message ->
      Log.w(TAG, "$message in $fileName")
    }
  }
}
