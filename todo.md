# roadmap & release readiness (v2.0)

technical checklist and roadmap for the v2.0 production release and future iterations. this document outlines data migration tasks, functional playback requirements, library and playlist management, network resilience, architectural hardening, and long-term vision.

---

## 1. legacy data migration & storage (v1 -> v2 upgrade)

upgrading users from previous versions require automated data migration and cleanup to prevent session resets and orphaned disk usage.

- [ ] **credentials & session auto-migration**
  - **context**: legacy builds stored credentials in android `SharedPreferences` (`flutter.server_url`, `flutter.username`, `flutter.password`). v2 uses [`expo-secure-store`](./services/backup.ts).
  - **task**: create a one-time startup routine that checks for legacy shared preferences, imports credentials into secure store, and marks migration complete to avoid forcing users to re-login.
- [ ] **orphaned cache & media cleanup**
  - **context**: legacy downloaded files were saved in `<app_dir>/app_flutter/offline/{tracks,covers,lyrics,meta}`. v2 stores cache under [`Paths.document + "/manual-cache"`](./services/songCache.ts) and `"/auto-cache"`.
  - **task**: detect legacy `app_flutter/offline` directories on app launch and provide an automated or prompt-based cleanup to reclaim disk space.

- [ ] **settings migration & safe fallbacks**
  - **context**: legacy preferences (`stop_playback_on_task_removed`, `auto_save_offline_played`, `home_sections`) were serialized in shared preferences.
  - **task**: ensure legacy settings keys are imported into sqlite on first run and all missing keys gracefully fall back to default values.

- [x] **profile backup/export compatibility**
  - verified: backup json schema (`navidrome_client_backup`) parses correctly with full backward compatibility in [`parseProfileData`](./services/backup.ts).

---

## 2. audio engine & playback

- [ ] **gapless playback (architectural)**
  - **context**: native exoplayer loads one track at a time, resulting in brief silence between consecutive songs.
  - **task**: update native audio playback module to pre-buffer the upcoming `MediaItem` into exoplayer's native playlist sequence to eliminate track gaps.

- [x] **playback queue management & ui**
  - verified: dedicated "now playing / up next" queue view integrated seamlessly into player screen ([`app/player.tsx`](./app/player.tsx)) and standalone route ([`app/queue.tsx`](./app/queue.tsx)) via [`components/PlaybackQueueView.tsx`](./components/PlaybackQueueView.tsx) and [`usePlaybackQueue`](./services/player.ts). features active song card, collapsible history section, track jumping, individual item removal, clear remaining queue confirmation, and move up/down track reordering.
  - note: drag-and-drop gesture reordering deferred as follow-up task.

- [x] **dynamic queue operations in player service**
  - verified: exposed queue mutation methods in [`services/player.ts`](./services/player.ts) (`playNext(song)`, `addToQueue(song)`, `removeFromQueue(index)`, `clearQueue()`, `moveQueueItem(from, to)`, `setQueue(newQueue)`) with session persistence and full test suite verification.

- [x] **scrubber / interactive seek bar & modular skin system**
  - verified: interactive draggable slider with reanimated gesture scrubbing, animated thumb, floating preview timestamp tooltip, and modular skin architecture (`PlayerSeekBarSkin`) in [`components/PlayerSeekBar.tsx`](./components/PlayerSeekBar.tsx) integrated into [`app/player.tsx`](./app/player.tsx).

- [x] **bulk offline song caching**
  - verified: bulk downloading of albums and playlists with progress and cancellation via [`components/BulkSongCacheButton.tsx`](./components/BulkSongCacheButton.tsx).

- [ ] **resumable playback / mini player state after notification dismissal**
  - **context**: tapping the close icon on the android media notification stops the native playback service. when returning to the app, the mini player remains visible, but tapping play fails to resume playback.
  - **task**: audit player state lifecycle when the notification is closed by the user. either make the player resumable (re-instantiating the audio session from current track state upon play), or automatically dismiss/hide the mini player when playback is closed.

- [ ] **audio focus ducking & transient loss recovery (high priority)**
  - **context**: while `setHandleAudioBecomingNoisy(true)` handles headphone disconnections, transient audio focus losses (such as turn-by-turn navigation prompts, incoming alarms/notifications, and phone calls) require explicit ducking and pause/resume logic in the native playback service.
  - **task**: audit audio focus transient vs exclusive loss in `AudioPlaybackService.kt`. duck audio volume during transient loss and cleanly pause and resume upon phone call completion.

- [ ] **sleep timer gradual volume fade-out (low priority)**
  - **context**: [`services/sleepTimer.ts`](./services/sleepTimer.ts) pauses playback abruptly when the timer expires, which can startle a sleeping user.
  - **task**: smoothly ramp audio volume down over the final 30–60 seconds prior to triggering the pause executor.

- [ ] **playback speed / rate controls (low priority)**
  - **context**: listeners of audiobooks, podcasts, or lecture tracks on navidrome currently lack playback speed options.
  - **task**: expose variable playback speed options (0.75x, 1.0x, 1.25x, 1.5x, 2.0x) in the player controls using exoplayer's `setPlaybackSpeed()`.

---

## 3. library, playlists & navigation

- [x] **artist details page (`app/(main)/library/artist/[id].tsx`)**
  - **context**: [`app/(main)/library/artists.tsx`](<./app/(main)/library/artists.tsx>) displays artists from local sqlite, with list items navigating to the destination page.
  - **task**:
    - implemented `artist/[id].tsx` screen displaying artist biography, artwork, albums list, and songs.
    - wired navigation `onPress` in `app/(main)/library/artists.tsx` and `app/(main)/search.tsx`.

- [ ] **playlist management & mutations**
  - **task**: add full playlist crud and modification controls connected to subsonic endpoints:
    - create new playlist dialog.
    - "add to playlist" option from song actions/menus across player and library lists.
    - reorder songs within a playlist (`updatePlaylist`).
    - remove songs from a playlist or delete playlist.

- [ ] **playlist details local caching**
  - **context**: [`app/(main)/library/playlist/[id].tsx`](<./app/(main)/library/playlist/[id].tsx>) currently fetches playlist songs from the network on every view open.
  - **task**: persist playlist songs into local sqlite during sync and cache on demand so playlist details open instantly and can be browsed offline.

- [ ] **universal entity components & deep linking across the app**
  - **context**: [`app/player.tsx`](./app/player.tsx) has deep links to artist and album pages. instead of ad-hoc nested touchables, entities (songs, albums, artists, playlists) will use universal components with tap-to-play/open, standard text overflow/a11y, and a 3-dot `⋯` / long-press context menu for deep links and options.
  - **task**:
    - [x] **audit & surface mapping**: identified and documented all views, routes (`/artist/[id]`, `/album/[id]`), and touch interaction patterns.
    - [x] **mini-player streamlining**: streamlined mini-player with unified player expansion tap and single play/pause control.
    - [x] **universal song row (`<SongRow />`)**:
      - verified: implemented universal `<SongRow />` and `<SongContextMenuModal />` with tap-to-play, long-press and 3-dot `⋯` context sheet (`play next`, `add to queue`, `go to artist`, `go to album`, `favorite`/`unfavorite`, download status).
      - standardized a11y attributes (`accessibilityRole`, lowercase labels) and text overflow tail truncation.
      - offline cache indicator / button integration via `<SongCacheButton />`.
      - rolled out across surfaces: [`app/(main)/library/songs.tsx`](<./app/(main)/library/songs.tsx>), [`app/album/[id].tsx`](./app/album/[id].tsx), [`app/artist/[id].tsx`](./app/artist/[id].tsx), [`app/(main)/library/playlist/[id].tsx`](<./app/(main)/library/playlist/[id].tsx>), [`app/(main)/library/offline.tsx`](<./app/(main)/library/offline.tsx>), search results ([`app/(main)/search.tsx`](./app/(main)/search.tsx)), and homepage tracks ([`components/home/RandomTracksSection.tsx`](./components/home/RandomTracksSection.tsx)).
    - [ ] **universal song list & row extensibility for specialized screens**:
      - **context**: screens like pending scrobbles ([`app/(main)/library/scrobbles.tsx`](./app/(main)/library/scrobbles.tsx)), download queue ([`app/(main)/library/queue.tsx`](./app/(main)/library/queue.tsx)), and available offline ([`app/(main)/library/offline.tsx`](./app/(main)/library/offline.tsx)) have specialized requirements (custom right actions like delete/retry/cancel, live progress rings, sync status badges, attempt counts, and secondary metadata lines like played timestamps).
      - **task**: extend the universal song list (`<SongRow />` and a shared song list container) to natively accommodate these screens without ad-hoc list item implementations, supporting configurable accessory slots, status badges, secondary metadata lines, and custom right actions.
    - [ ] **universal album components (`<AlbumRow />` & `<AlbumCard />`)**:
      - support both list view and grid view variants (including grid toggle on [`app/(main)/library/albums.tsx`](<./app/(main)/library/albums.tsx>)).
      - tap opens album detail; long press / 3-dot `⋯` menu includes `go to artist`.
      - rollout across surfaces: [`app/(main)/library/albums.tsx`](<./app/(main)/library/albums.tsx>), homepage album sections ([`components/home/`](./components/home/)), and search results.
    - [ ] **universal artist & playlist rows (`<ArtistRow />` & `<PlaylistRow />`)**:
      - standardized list rows with context options for [`app/(main)/library/artists.tsx`](<./app/(main)/library/artists.tsx>), [`app/(main)/library/playlists.tsx`](<./app/(main)/library/playlists.tsx>), and search results.

- [x] **offline filter in search (`app/(main)/search.tsx`)**
  - **context**: search queries songs, albums, and artists in local sqlite, but lacks a quick filter for content available offline.
  - **task**: add an "available offline" filter chip/toggle on the search screen to filter results strictly to cached media.
  - **completed**:
    - added `searchCachedAlbums` and `searchCachedArtists` SQLite queries in [`services/db.ts`](./services/db.ts) matching albums and artists that have tracks cached in `song_cache`.
    - added `available offline` filter chip with `cloud-check`/`cloud-outline` toggle icon on [`app/(main)/search.tsx`](<./app/(main)/search.tsx>) to filter songs, albums, and artists strictly to locally cached media.
    - subscribed to `subscribeSongCache` for real-time reactivity when offline cached media changes.
    - updated category empty state prompts to clarify offline search results.
    - added unit tests in [`__tests__/services/db_search.test.ts`](./__tests__/services/db_search.test.ts) and [`__tests__/screens/search.test.tsx`](./__tests__/screens/search.test.tsx).

- [x] **pending scrobbles screen**
  - **context**: offline plays are queued in sqlite via [`services/scrobbleQueue.ts`](./services/scrobbleQueue.ts) until an internet connection is restored.
  - **task**: create a dedicated screen in library/settings to view pending scrobbles, display attempt counts and sync status, and allow manual sync triggering or individual deletion.
  - **completed**:
    - created [`app/(main)/library/scrobbles.tsx`](./app/(main)/library/scrobbles.tsx) dedicated pending scrobbles screen with real-time reactivity via `subscribeScrobbleQueue`.
    - displays item cover art, title, artist, album, relative played timestamp, and attempt count badges.
    - supports batch "sync now" manual sync triggering with live status indicators, pull-to-refresh, individual retry sync, individual item deletion, and "clear all".
    - added navigation entry buttons in [`app/(main)/library/index.tsx`](./app/(main)/library/index.tsx) and under scrobble settings in [`app/(main)/settings.tsx`](./app/(main)/settings.tsx).

- [ ] **starred / favorites screen (`app/(main)/library/starred.tsx`) (medium priority)**
  - **context**: star/unstar api operations exist, but there is no dedicated destination in the library tab to browse all favorited songs, albums, or artists in one place.
  - **task**: create `app/(main)/library/starred.tsx` with tabs/filters for starred songs, albums, and artists, integrated with subsonic `getStarred` and local sqlite.

- [x] **pull-to-refresh across screens**
  - **task**:
    - added `RefreshControl` across detail screens ([`app/album/[id].tsx`](./app/album/[id].tsx), [`app/artist/[id].tsx`](./app/artist/[id].tsx)), library collection screens ([`app/(main)/library/songs.tsx`](<./app/(main)/library/songs.tsx>), [`albums.tsx`](<./app/(main)/library/albums.tsx>), [`artists.tsx`](<./app/(main)/library/artists.tsx>), [`playlists.tsx`](<./app/(main)/library/playlists.tsx>)), and utility screens ([`offline.tsx`](<./app/(main)/library/offline.tsx>), [`queue.tsx`](<./app/(main)/library/queue.tsx>), [`sync.tsx`](<./app/(main)/sync.tsx>)).
    - updated home random sections iconography from `refresh` to `shuffle-variant` to distinguish local reshuffling from network sync.

- [ ] **audit & placement of cache button (make available offline)**
  - **context**: [`components/SongCacheButton.tsx`](./components/SongCacheButton.tsx) and [`components/BulkSongCacheButton.tsx`](./components/BulkSongCacheButton.tsx) allow saving songs and collections offline.
  - **task**: identify and document all places and surfaces across the app where the cache button (make available offline button) should be displayed (e.g. song list items, album details, playlist details, artist details, now playing full player, search results).

- [x] **recent search history (low priority)**
  - **context**: [`app/(main)/search.tsx`](<./app/(main)/search.tsx>) displays an empty view when the search query is blank.
  - **task**: store recent search terms in sqlite and display them as tappable chips with a "clear recent searches" option when the search bar is active.

---

## 4. settings, home customization & changelog

- [ ] **reorderable and hideable home page sections**
  - **context**: home page sections are currently statically mapped in [`components/home/index.ts`](./components/home/index.ts).
  - **task**: add a settings screen to reorder home sections via drag-and-drop and toggle visibility on/off, persisted to local preferences.

- [x] **in-app changelog dialogs**
  - **task**:
    - [x] **settings access**: make the version number in settings clickable to show the full changelog modal with current version open and previous versions in closed accordions ([`components/ChangelogModal.tsx`](./components/ChangelogModal.tsx)).
    - [x] **first-launch post-update**: detect version code increase on launch and display a "what's new" changelog modal automatically once ([`app/_layout.tsx`](./app/_layout.tsx)).

- [x] **haptic feedback toggle in settings & profile export**
  - **context**: haptic feedback is routed through centralized helpers ([`utils/haptics.ts`](./utils/haptics.ts)) checking [`getHapticsEnabled()`](./services/db.ts) and is supported in [`BackupSettings`](./types/backup.ts).
  - **task**: add a settings switch in [`app/(main)/settings.tsx`](./app/(main)/settings.tsx) to toggle haptic feedback on/off globally, and preserve the preference when exporting or importing profile backups in [`services/backup.ts`](./services/backup.ts).

- [ ] **continuous ui/ux & interaction refinements**
  - **task**: ongoing refinement of tactile haptic feedback on actions, spacing and typography consistency across device sizes, dark mode contrast, smooth route animations, and accessible touch targets.

- [ ] **app performance & render optimization**
  - **context**: large music libraries (thousands of songs/albums) can experience frame drops during fast scrolling, view transitions, or image loading spikes.
  - **task**:
    - profile and optimize list rendering across library and search screens (`getItemLayout`, window size tuning, row memoization).
    - optimize memory footprint and image cache pre-warming with `expo-image`.
    - minimize redundant react re-renders triggered by high-frequency player state and download progress updates.

---

## 5. network resilience & offline experience (pre-v2)

- [/] **alternate / fallback server urls (pre-v2 requirement)**
  - **context**: users running split-dns or separate local and external domain setups require automated fallback.
  - **status**: partially complete.
    - [x] connect screen progressive disclosure ui (add up to 4 alternative urls, hidden until non-empty).
    - [x] unified parallel ping engine (`pingFastestServer`) with latency measurement across all candidate urls.
    - [x] winner selection on connect, demo login, and profile import, displayed on stage 2 and sync screen with original `label (url)`.
    - [x] profile backup export and restore compatibility for `server_urls`.
    - [ ] auto fallback / failover logic on transport network failures (pending).
    - [ ] settings screen ui to view, add, reorder, test ping, and manually switch active server url (pending).
    - [x] backward compatibility / upgrade migration: automated startup routine in [`app/_layout.tsx`](./app/_layout.tsx) backfills `serverUrls = [{ url, label: "server url" }]` and `serverUrlLabel = "server url"` for existing users who already have `serverUrl` in `SecureStore`.

- [ ] **graceful offline error feedback**
  - **context**: cached songs play locally and library metadata is stored in sqlite. offline playback operates without network dependency.
  - **task**:
    - show non-blocking snackbars when an action requires internet (e.g. streaming an uncached song or triggering manual library sync while disconnected).
    - ensure no intrusive blocking modal or unwanted global state flips occur during transient connection drops.

- [ ] **offline user experience & state transitions (when app goes offline)**
  - **context**: when network drops (subways, flights, dead zones), the app needs a cohesive, predictable lifecycle based on what the user is currently doing:
    - **mid-stream playback interruption**: if an uncached stream drops mid-song, gracefully pause with a clear inline retry indicator or offer to skip to the next available cached song in queue, rather than failing silently or crashing exoplayer.
    - **library browsing & affordances**: visually differentiate cached vs uncached content while disconnected (e.g. dimming uncached rows or providing a quick one-tap toggle to filter to offline-only media).
    - **offline mutation queueing**: queue user actions taken offline (starring, ratings, scrobbles, playlist additions) in local sqlite and automatically replay them when connection is restored.
    - **download queue pausing & auto-resume**: pause in-flight downloads cleanly on connection drop without corrupting active cache files, and resume automatically when network connectivity is re-established.
    - **reconnection auto-recovery**: smoothly reconnect, ping fallback urls if needed, and flush pending scrobbles/mutations in the background without ui stutters or interrupting active audio playback.

- [ ] **persist album art for offline cached songs**
  - **context**: when songs are cached for offline playback via [`services/songCache.ts`](./services/songCache.ts), the audio stream is saved to disk, but album artwork is not explicitly stored in permanent offline storage for expo-image, causing missing covers offline.
  - **task**: explicitly download and persist album cover art alongside cached songs to ensure artwork is always available offline.

- [ ] **storage breakdown & cache management screen (medium priority)**
  - **context**: users can toggle auto-cache limits in settings, but there is no screen showing how much disk space is consumed by manual downloads, auto-cache, album art, or database data, nor any way to delete cached albums/artists without logging out.
  - **task**: add a dedicated storage management view in settings or library showing disk usage breakdown by artist/album, sorted by size, with bulk prune/delete actions.

- [ ] **download over wi-fi only toggle (low priority)**
  - **context**: bulk caching large playlists or discographies over cellular data can unintentionally drain user data allowances.
  - **task**: add a setting (`"download only on wi-fi"`) that pauses queued offline caching when connected via cellular networks.

- [ ] **incremental / delta library sync**
  - **context**: [`client_app_sync()`](./services/api.ts) currently pulls the entire library during sync operations, which can be slow on large collections.
  - **task**: verify and implement delta synchronization using subsonic `getScanStatus` / server scan timestamps to fetch only modified albums and tracks since the last sync.

---

## 6. architectural stability, database & code health

- [ ] **sqlite schema versioning & migration runner**
  - **context**: [`services/db.ts`](./services/db.ts) initializes tables strictly using `CREATE TABLE IF NOT EXISTS` without schema version tracking. subsequent schema updates (new columns or modified tables) will fail to apply to existing databases on upgraded devices, causing runtime sql errors.
  - **task**: implement a versioned migration runner utilizing `PRAGMA user_version` to apply incremental `ALTER TABLE` and schema migration scripts reliably across app updates.

- [ ] **audit and eliminate silent exception swallowing**
  - **context**: more than 40 instances of empty `catch { }` blocks exist across services ([`services/player.ts`](./services/player.ts), [`services/songCache.ts`](./services/songCache.ts), [`services/lyrics.ts`](./services/lyrics.ts)), preventing errors in downloads, caching, and playback from being diagnosed.
  - **task**: audit all catch blocks; replace bare empty catches with structured error logging and sentry breadcrumb capture where appropriate.

- [ ] **js and native audio state synchronization**
  - **context**: [`services/player.ts`](./services/player.ts) relies on 17 mutable module-level `let` variables. because the android native foreground service and the react native javascript activity have distinct lifecycles, activity recreation can leave js state desynchronized from native playback.
  - **task**: ensure the native audio module is queried as the authoritative source of truth on app launch and activity resume, synchronizing the active track and status into js state.

- [ ] **decomposition of monolithic service and screen files**
  - **context**: core files have grown into large single-file monoliths:
    - [`services/db.ts`](./services/db.ts) (~1,200 lines): combines schema, library queries, caching, sessions, and scrobbling.
    - [`services/player.ts`](./services/player.ts) (~950 lines): tightly couples audio control, queue mutation, scrobbling, auto-cache triggers, and app state listeners.
    - [`app/player.tsx`](./app/player.tsx) (~900 lines): houses complex modals, lyrics sheets, rating menus, and art viewers in one view.
  - **task**: split database operations into domain-focused repository modules and extract player sub-components into dedicated modules.

- [ ] **backup profile credentials protection**
  - **context**: [`services/backup.ts`](./services/backup.ts) writes server passwords in plaintext to exported json files.
  - **task**: add optional passphrase-based encryption or clear security disclosures during export to avoid unencrypted credentials residing on public storage.

- [ ] **android foreground service for background downloads & sync**
  - **context**: bulk song caching ([`services/songCache.ts`](./services/songCache.ts)) and library sync ([`app/(main)/sync.tsx`](<./app/(main)/sync.tsx>)) currently run in the javascript runtime. if the user navigates away, locks the screen, or the app process is suspended by the os, downloads fail or stall unpredictably.
  - **task**: attach bulk downloads and library sync to a standard android foreground service (or workmanager) with an ongoing system notification displaying real-time progress, song counts, and a cancel action to guarantee task survival in the background.

---

## 7. play store ci/cd & automated deployment

- [x] **internal testing track automation**
  - workflow: [.github/workflows/release-internal.yml](.github/workflows/release-internal.yml) with fastlane `upload_internal`.

- [ ] **build pipeline optimization (ci & compilation speed)**
  - **context**: android release builds in github actions currently take 20+ minutes to compile and assemble from scratch. this is primarily driven by:
    - sequential execution of both `./gradlew bundleRelease` (aab) and `assembleRelease` (apk), running r8/proguard, hermes compilation, c++ ndk builds, and resource packaging twice.
    - absence of persistent gradle build caching and ccache across runner instances.
    - `--no-daemon` execution without gradle configuration caching or multi-worker parallelism flags.
  - **task**: optimize build speed and align with standard tooling:
    - generate universal apk directly from `app-release.aab` using `bundletool` instead of running `assembleRelease` separately (saving ~8-12 minutes).
    - adopt `gradle/actions/setup-gradle@v4` with read/write caching for gradle build and configuration cache.
    - configure `android/gradle.properties` build flags (`org.gradle.parallel=true`, `org.gradle.caching=true`, `org.gradle.jvmargs=-Xmx4g`).
    - evaluate standard cloud builds via eas build (expo application services) with prebuilt worker images and remote caching.

- [x] **separate development build variant (side-by-side install)**
  - **context**: developing locally with default package `com.thepmsquare.navidrome_client` conflicts with the play store release signature, requiring uninstallation that wipes local cache and saved music.
  - **task**: configure `app.config.ts` to assign `com.thepmsquare.navidrome_client.dev` and name `navidrome (dev)` during development so the play store app and dev build coexist on the same device without data loss.

- [ ] **closed testing track automation**
  - create `.github/workflows/release-closed.yml` and fastlane lane `upload_closed` for alpha/beta test groups.

- [ ] **open testing track automation**
  - create `.github/workflows/release-open.yml` and fastlane lane `upload_open` for public testing.

- [ ] **production track automation with staged rollouts**
  - create `.github/workflows/release-prod.yml` and fastlane lane `upload_production` supporting staged rollout percentages (e.g. 10%, 20%, 50%, 100%).

- [ ] **release branch isolation**
  - **task**: isolate v2.0 release stabilization on a dedicated branch (e.g. `release/v2.0.0`) to allow focused stabilization and testing prior to merging into main.

- [ ] **staged rollout execution**
  - execute phased release on google play console (10% -> 20% -> 50% -> 100%) to monitor crash rates and error tracking prior to full rollout.

---

## 8. future roadmap & long-term vision (post-v2.x)

features planned for major subsequent updates after the v2.0 core stability milestone:

- [ ] **local network server auto-discovery (mDNS / SSDP)**
  - discover local navidrome / subsonic servers automatically on the local wi-fi network during the initial connection flow.

- [ ] **shareable guest song links**
  - integrate subsonic sharing endpoints (`createShare`) to generate temporary public playback links with optional expiration times that can be played in any browser without requiring user credentials.

- [ ] **remote control for other navidrome clients**
  - use the navidrome/subsonic player session api to allow this app to act as a remote controller (play, pause, seek, volume, queue change) for other active clients on the account.

- [ ] **synchronized group listening ("jam" sessions)**
  - enable multiple users on the same server to join a shared synchronized listening session with a shared real-time queue and concurrent playback.

- [ ] **server statistics & analytics dashboard**
  - display server-side analytics from navidrome (user play stats, top played songs/artists, server uptime, and storage metrics).
