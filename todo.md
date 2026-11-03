# todo

status: `[ ]` todo · `[/]` in progress · `[x]` done

## migration & upgrade

- [ ] **credentials & session auto-migration** (`mig-1`)
  - **context:** legacy builds (`1.0.0`, `1.1.0`, `1.3.2`) stored credentials in android `SharedPreferences` (`flutter.server_url`, `flutter.username`, `flutter.password`). v2 uses [`expo-secure-store`](./services/backup.ts).
  - **reader:** [`modules/legacy-prefs`](./modules/legacy-prefs/index.ts) exposes `readLegacyCredentials()`, reading `FlutterSharedPreferences` first and skipping absent files, absent keys, and non-string values. `readLegacyPreferences()` also exposes `flutter.is_logged_in` and `flutter.alternate_server_urls` for session and server-url restore.
  - **task:** create a one-time startup routine that checks for legacy shared preferences, imports credentials into secure store, and marks migration complete so existing sessions remain authenticated. read keys defensively across legacy versions.

- [ ] **settings migration & safe fallbacks** (`mig-2`)
  - **context:** legacy preferences (`stop_playback_on_task_removed`, `auto_save_offline_played`, `home_sections`) were serialized in shared preferences.
  - **reader:** `readLegacyPreferences()` from [`modules/legacy-prefs`](./modules/legacy-prefs/index.ts) returns all migrated settings, including `autoSaveOfflineMaxBytes` and `autoSaveOfflineLruEvict`. `homeSections` is raw json and must be parsed defensively.
  - **task:** import legacy settings keys into sqlite on first run. all missing keys must gracefully fall back to defaults.

- [ ] **migration safety & idempotency** (`mig-3`)
  - **task:** make every migration step idempotent and failure-safe. a failed migration must log and fall back to the connect screen without crash-looping or wiping existing data. guard the routine behind a single "migration complete" flag.

- [x] **verify minSdk coverage for legacy installs** (`mig-4`)
  - **task:** confirm v2's `minSdk` covers devices on legacy builds. play keeps incompatible devices on the last compatible version.
  - **verified:** v2 is `minSdk 24` (android 7.0) — expo sdk 57 / rn 0.86 defaults and the merged manifest both report 24, with no override in `app.config.ts`. legacy was flutter using `flutter.minSdkVersion` with no override; flutter's default moved from 21 to 24 on 2025-07-02 (stable >= 3.35), and all legacy builds shipped 2026-04 to 2026-07-02, so legacy is also 24. no legacy install exists below 24, so every legacy device is upgrade-eligible and `mig-1`/`mig-2` cover the full legacy population.

- [ ] **sqlite schema versioning & migration runner** (`db-1`)
  - **context:** [`services/db.ts`](./services/db.ts) initializes tables using `CREATE TABLE IF NOT EXISTS` without schema version tracking. future schema changes will fail to apply to existing databases.
  - **task:** implement a versioned migration runner using `PRAGMA user_version` to apply incremental `ALTER TABLE` and schema migrations reliably across updates. bundle with `mig-1` and `mig-2`, which also run at startup.

- [ ] **upgrade smoke test** (`qa-1`)
  - **task:** install `1.3.2+24` from play, upgrade to the v2 build, and verify credentials, settings, downloaded songs, playback, and scrobbling. repeat from `1.0.0+19` or `1.1.0+20` if a device is available.
  - **minSdk parity:** legacy and v2 are both `minSdk 24`, so no device is stranded on the old build. confirm the v2 release is signed with the legacy upload key, otherwise play will reject the in-place upgrade.

## playback & audio

- [ ] **audio focus ducking & transient loss recovery** (`pb-1`)
  - **context:** `setHandleAudioBecomingNoisy(true)` handles headphone disconnects, but transient focus losses (navigation prompts, alarms, calls) require explicit ducking and pause/resume logic.
  - **task:** audit transient vs exclusive focus loss in `AudioPlaybackService.kt`. duck volume during transient loss. pause and resume cleanly after calls.

- [ ] **resumable playback after notification dismissal** (`pb-2`)
  - **context:** tapping the close icon on the android media notification stops the native playback service. returning to the app leaves the mini player visible, but play fails to resume.
  - **task:** audit the player state lifecycle when the notification is closed. either re-instantiate the audio session from the current track on play, or hide the mini player when playback is closed.

- [ ] **gapless playback** (`pb-3`)
  - **context:** native exoplayer loads one track at a time, causing brief silence between songs.
  - **task:** pre-buffer the upcoming `MediaItem` into exoplayer's native playlist sequence.

- [ ] **sleep timer gradual fade-out** (`pb-4`)
  - **context:** [`services/sleepTimer.ts`](./services/sleepTimer.ts) pauses abruptly.
  - **task:** ramp volume down over the final 30–60 seconds.

- [ ] **js and native audio state synchronization** (`arch-1`)
  - **context:** [`services/player.ts`](./services/player.ts) relies on module-level mutable state. activity recreation can desynchronize js from native playback.
  - **task:** treat the native audio module as authoritative on launch and resume. sync active track and status into js.

## library & playlists

- [ ] **universal entity components & deep linking across the app** (`ui-2`)
  - **context:** entities (songs, albums, artists, playlists) share tap-to-play/open, standard text overflow/a11y, and a 3-dot / long-press context menu.
  - **task:**
    - [x] audit & surface mapping
    - [x] mini-player streamlining
    - [x] universal song row + context menu
    - [x] universal album components (`<AlbumRow />` / `<AlbumCard />`) across library, search, home, artist detail
    - [/] universal artist & playlist rows (`<ArtistRow />` / `<PlaylistRow />`) across library and search
    - [/] specialized song list extensibility for download queue and pending scrobbles

- [ ] **playlist management & mutations** (`lib-1`)
  - **context:** only read paths exist (`getPlaylists`, `getPlaylist`). there is no create/update/delete api or ui.
  - **task:**
    - create new playlist dialog.
    - "add to playlist" from song menus across player and library.
    - remove songs from a playlist.
    - reorder songs within a playlist (`updatePlaylist`).
    - delete playlist.

- [ ] **playlist details local caching** (`lib-2`)
  - **context:** [`app/(main)/library/playlist/[id].tsx`](<./app/(main)/library/playlist/[id].tsx>) fetches songs from the network on every open.
  - **task:** persist playlist songs into sqlite during sync and cache on demand so details open instantly and browse offline.

- [ ] **starred / favorites screen** (`lib-3`)
  - **task:** `app/(main)/library/starred.tsx` with tabs/filters for starred songs, albums, and artists, integrated with subsonic `getStarred` and local sqlite.

- [ ] **audit & placement of cache button** (`lib-4`)
  - **task:** document every surface where the "make available offline" button should appear (song rows, album, playlist, artist, player, search) and implement the missing placements.

## offline & network

- [ ] **persist album art for offline cached songs** (`off-1`)
  - **context:** [`services/songCache.ts`](./services/songCache.ts) saves audio but not artwork, so covers are missing offline.
  - **task:** download and persist cover art alongside cached songs. resolve cached covers before network urls.

- [ ] **graceful offline error feedback** (`off-2`)
  - **task:** show non-blocking snackbars when an action requires internet (streaming an uncached song, manual sync while offline). avoid blocking modals or global state flips during transient drops.

- [ ] **download keep-awake mitigation** (`off-3`)
  - **context:** bulk caching runs in the js runtime and stalls when the app is backgrounded. a foreground service is tracked as `off-4`.
  - **task:** keep the screen awake during active downloads and display a banner requesting that the app remain open. rely on the existing `resumePendingDownloadsAfterRestart()` for process death.

- [ ] **android foreground service for downloads & sync** (`off-4`)
  - **context:** bulk caching and library sync run in the js runtime and stall when the app is suspended.
  - **task:** attach downloads and sync to a foreground service / workmanager with an ongoing notification showing progress, counts, and cancel.

- [ ] **offline user experience & state transitions** (`off-5`)
  - **task:**
    - mid-stream interruption: pause gracefully with retry or skip to the next cached song.
    - visually differentiate cached vs uncached content while offline.
    - queue offline mutations (star, rating, scrobbles, playlist additions) and replay on reconnect.
    - pause in-flight downloads cleanly on connection drop and resume automatically.
    - reconnect, ping fallback urls, and flush queues without interrupting playback.

- [ ] **storage breakdown & cache management screen** (`off-6`)
  - **task:** show disk usage by manual downloads, auto-cache, artwork, and database. sort by artist/album. bulk prune/delete.

- [ ] **download over wi-fi only toggle** (`off-7`)
  - **task:** pause queued caching on cellular connections.

- [ ] **incremental / delta library sync** (`off-8`)
  - **context:** [`client_app_sync()`](./services/api.ts) pulls the entire library each sync.
  - **task:** use `getScanStatus` / server scan timestamps to fetch only changed albums and tracks since the last sync.

- [ ] **orphaned legacy cache cleanup** (`off-9`)
  - **context:** legacy downloads live in `<app_dir>/app_flutter/offline/{tracks,covers,lyrics,meta}`. v2 uses `manual-cache` and `auto-cache`.
  - **task:** detect legacy directories on launch and offer cleanup to reclaim disk space.

- [ ] **auto fallback / failover on transport failures** (`net-1`)
  - **context:** alternate server urls are stored and pinged on connect, but runtime requests still target the active url only.
  - **task:** wrap request building so transport failures retry the next candidate url, update the active url on success, and debounce flapping. manual control is tracked as `net-2`.

- [ ] **server url management screen** (`net-2`)
  - **context:** partially complete. connect-screen inputs, parallel ping, winner selection, backup compatibility, and startup backfill are done.
  - **task:**
    - [/] view saved urls, active badge, latency, and test ping.
    - [ ] switch active url without logging out.
    - [ ] add/remove urls (keep at least one, block removing the active one).
    - [ ] reorder urls (priority order for `net-1`).

## settings & ui

- [ ] **reorderable and hideable home page sections** (`ui-1`)
  - **context:** home sections are statically mapped in [`components/home/index.ts`](./components/home/index.ts).
  - **task:** settings screen to reorder via drag-and-drop and toggle visibility, persisted locally.

- [ ] **continuous ui/ux refinements** (`eng-5`)
  - **task:** haptics, spacing, typography, dark-mode contrast, route animations, and touch targets.

## security

- [ ] **backup export credentials disclosure** (`sec-1`)
  - **context:** [`services/backup.ts`](./services/backup.ts) writes server passwords in plaintext to exported json.
  - **task:** add a warning/disclosure during export. passphrase encryption is tracked as `sec-2`.

- [ ] **backup profile credentials encryption** (`sec-2`)
  - **task:** optional passphrase-based encryption for exported profiles. `sec-1` provides the disclosure.

## architecture & code health

- [ ] **shared entity context sheet** (`ui-3`)
  - **task:** deduplicate `SongContextMenuModal`, `AlbumContextMenuModal`, `ArtistContextMenuModal`, and `PlaylistContextMenuModal` into one configurable sheet. requires all four context menus to exist.

- [ ] **silent exception swallowing audit** (`eng-1`)
  - **task:** replace empty `catch { }` blocks across services with structured `console.error` logging. apply incrementally when the affected files are modified.

- [ ] **decomposition of monoliths** (`eng-2`)
  - **context:** [`services/db.ts`](./services/db.ts) is ~1,200 lines and [`app/player.tsx`](./app/player.tsx) is ~900 lines.
  - **task:** split the database into domain repositories and extract player sub-components into dedicated modules.

- [ ] **performance & render optimization** (`eng-3`)
  - **task:** profile list rendering (`getItemLayout`, window size, memoization), tune `expo-image` cache, and reduce re-renders from player and download progress.

- [ ] **build pipeline optimization** (`eng-4`)
  - **context:** release builds take 20+ minutes because the aab and apk are built separately and gradle caching is absent.
  - **task:** build the universal apk from the aab with `bundletool` instead of a second `assembleRelease`, add gradle caching and configuration cache, and enable parallel builds.

- [ ] **local js error log + export** (`dbg-1`)
  - **context:** play vitals only surfaces native crashes and anrs.
  - **task:** keep a bounded ring buffer of js errors in sqlite and expose "export debug logs" in settings.

## release & testing

- [ ] **closed testing track automation + release branch** (`ci-1`)
  - **task:** add `.github/workflows/release-closed.yml` and fastlane lane `upload_closed` for alpha/beta test groups. create `release/v2.0` for stabilization before merging to main.

- [ ] **open testing track automation** (`ci-2`)
  - **task:** add `.github/workflows/release-open.yml` and fastlane lane `upload_open`.

- [ ] **production track automation with staged rollout** (`ci-3`)
  - **task:** add `.github/workflows/release-prod.yml` and fastlane lane `upload_production` with staged rollout percentages (e.g. 10%, 20%, 50%, 100%).

- [ ] **store listing & compliance** (`store-1`)
  - **task:** update the play store listing (description, screenshots, feature graphic), data safety form, and content rating. confirm [`privacy_policy.html`](./privacy_policy.html) is published.

- [ ] **crash visibility** (`store-2`)
  - **context:** crash visibility relies on google play android vitals.
  - **task:** upload the r8 mapping file and native debug symbols during release builds so vitals show readable stack traces.

- [ ] **final privacy & data-safety review** (`store-3`)
  - **task:** re-check the data safety form against the shipped build (network calls, local storage, exports) and confirm the privacy policy covers everything.

- [ ] **staged rollout** (`rel-1`)
  - **task:** roll out 10% → 50% → 100% while monitoring vitals and crash reports.

## future

- [ ] **local network server auto-discovery (mdns / ssdp)** (`future-1`)
- [ ] **shareable guest song links (`createShare`)** (`future-2`)
- [ ] **remote control for other navidrome clients** (`future-3`)
- [ ] **synchronized group listening ("jam" sessions)** (`future-4`)
- [ ] **server statistics & analytics dashboard** (`future-5`)
