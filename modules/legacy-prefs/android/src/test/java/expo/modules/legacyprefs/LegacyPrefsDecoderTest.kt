package expo.modules.legacyprefs

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class LegacyPrefsDecoderTest {
  private companion object {
    const val LIST_PREFIX = "VGhpcyBpcyB0aGUgcHJlZml4IGZvciBhIGxpc3Qu!"
    const val HOME_SECTIONS = """[{"id":"most_played","visible":true}]"""
  }

  @Test
  fun `returns null when no known keys are present`() {
    assertNull(LegacyPrefsDecoder.decode(emptyMap<String, Any?>()))
    assertNull(LegacyPrefsDecoder.decode(mapOf("unrelated" to "value")))
  }

  @Test
  fun `decodes every known key`() {
    val decoded = LegacyPrefsDecoder.decode(fullPreferences())

    val expected = mapOf(
      "flutter.server_url" to "https://music.example.com",
      "flutter.username" to "alice",
      "flutter.password" to "secret",
      "flutter.home_sections" to HOME_SECTIONS,
      "flutter.is_logged_in" to true,
      "flutter.stop_playback_on_task_removed" to false,
      "flutter.auto_save_offline_played" to true,
      "flutter.auto_save_offline_lru_evict" to false,
      "flutter.auto_save_offline_max_bytes" to 1_073_741_824L,
      "flutter.alternate_server_urls" to listOf(
        "https://backup.example.com",
        "https://fallback.example.com"
      )
    )

    assertEquals(expected, decoded)
  }

  @Test
  fun `omits absent keys`() {
    val decoded = LegacyPrefsDecoder.decode(
      mapOf("flutter.server_url" to "https://music.example.com")
    )

    assertEquals(
      mapOf("flutter.server_url" to "https://music.example.com"),
      decoded
    )
  }

  @Test
  fun `falls back to unprefixed keys`() {
    val decoded = LegacyPrefsDecoder.decode(mapOf("username" to "alice"))

    assertEquals(mapOf("flutter.username" to "alice"), decoded)
  }

  @Test
  fun `prefers the prefixed key when both exist`() {
    val decoded = LegacyPrefsDecoder.decode(
      mapOf(
        "flutter.username" to "prefixed",
        "username" to "unprefixed"
      )
    )

    assertEquals(mapOf("flutter.username" to "prefixed"), decoded)
  }

  @Test
  fun `skips non-string values for string keys`() {
    val warnings = mutableListOf<String>()
    val decoded = LegacyPrefsDecoder.decode(
      mapOf(
        "flutter.server_url" to 42,
        "flutter.username" to true
      )
    ) { warnings.add(it) }

    assertNull(decoded)
    assertEquals(2, warnings.size)
    assertTrue(warnings[0].contains("flutter.server_url"))
  }

  @Test
  fun `skips non-boolean values for boolean keys`() {
    val warnings = mutableListOf<String>()
    val decoded = LegacyPrefsDecoder.decode(
      mapOf("flutter.is_logged_in" to "true")
    ) { warnings.add(it) }

    assertNull(decoded)
    assertEquals(1, warnings.size)
  }

  @Test
  fun `accepts long, int, and numeric string for numeric keys`() {
    assertEquals(
      mapOf("flutter.auto_save_offline_max_bytes" to 10L),
      LegacyPrefsDecoder.decode(
        mapOf("flutter.auto_save_offline_max_bytes" to 10L)
      )
    )
    assertEquals(
      mapOf("flutter.auto_save_offline_max_bytes" to 20L),
      LegacyPrefsDecoder.decode(
        mapOf("flutter.auto_save_offline_max_bytes" to 20)
      )
    )
    assertEquals(
      mapOf("flutter.auto_save_offline_max_bytes" to 30L),
      LegacyPrefsDecoder.decode(
        mapOf("flutter.auto_save_offline_max_bytes" to "30")
      )
    )
    assertNull(
      LegacyPrefsDecoder.decode(
        mapOf("flutter.auto_save_offline_max_bytes" to "not-a-number")
      )
    )
  }

  @Test
  fun `decodes string lists from json, list, and set`() {
    val expected = mapOf("flutter.alternate_server_urls" to listOf("a", "b"))

    assertEquals(
      expected,
      LegacyPrefsDecoder.decode(
        mapOf(
          "flutter.alternate_server_urls" to "$LIST_PREFIX[\"a\",\"b\"]"
        )
      )
    )
    assertEquals(
      expected,
      LegacyPrefsDecoder.decode(
        mapOf("flutter.alternate_server_urls" to listOf("a", "b"))
      )
    )
    assertEquals(
      expected,
      LegacyPrefsDecoder.decode(
        mapOf("flutter.alternate_server_urls" to setOf("a", "b"))
      )
    )
  }

  @Test
  fun `skips string lists with an unsupported encoding`() {
    val warnings = mutableListOf<String>()

    assertNull(
      LegacyPrefsDecoder.decode(
        mapOf("flutter.alternate_server_urls" to "[\"a\",\"b\"]")
      ) { warnings.add(it) }
    )
    assertNull(
      LegacyPrefsDecoder.decode(
        mapOf("flutter.alternate_server_urls" to "$LIST_PREFIX not json")
      )
    )
    assertEquals(1, warnings.size)
  }

  private fun fullPreferences(): Map<String, Any?> {
    return mapOf(
      "flutter.server_url" to "https://music.example.com",
      "flutter.username" to "alice",
      "flutter.password" to "secret",
      "flutter.home_sections" to HOME_SECTIONS,
      "flutter.is_logged_in" to true,
      "flutter.stop_playback_on_task_removed" to false,
      "flutter.auto_save_offline_played" to true,
      "flutter.auto_save_offline_lru_evict" to false,
      "flutter.auto_save_offline_max_bytes" to 1_073_741_824L,
      "flutter.alternate_server_urls" to
        "$LIST_PREFIX[\"https://backup.example.com\",\"https://fallback.example.com\"]"
    )
  }
}
