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

- [ ] **playback queue management & ui**
  - **context**: currently only a download queue exists in [`app/(main)/library/queue.tsx`](./app/(main)/library/queue.tsx).
  - **task**: create a dedicated "now playing / up next" queue screen with support for:
    - viewing queued songs and current track index
    - drag-and-drop queue reordering
    - removing individual tracks from queue
    - clearing remaining queue

- [ ] **dynamic queue operations in player service**
  - **task**: expose queue mutation methods in [`services/player.ts`](./services/player.ts):
    - `playNext(song)`: insert track immediately after the active track.
    - `addToQueue(song)`: append track to the end of the current queue.
    - `removeFromQueue(index)`: remove specific track without stopping active playback.
    - `clearQueue()`: empty all upcoming tracks.

- [ ] **scrubber / interactive seek bar**
  - **context**: playback progress bar only supports tap-to-seek without dragging or preview ([`app/player.tsx`](./app/player.tsx)).
  - **task**: implement a draggable slider in `app/player.tsx` with live scrub timestamp preview and smooth timeline scrubbing.

- [x] **bulk offline song caching**
  - verified: bulk downloading of albums and playlists with progress and cancellation via [`components/BulkSongCacheButton.tsx`](./components/BulkSongCacheButton.tsx).

---

## 3. library, playlists & navigation

- [x] **artist details page (`app/(main)/library/artist/[id].tsx`)**
  - **context**: [`app/(main)/library/artists.tsx`](./app/(main)/library/artists.tsx) displays artists from local sqlite, with list items navigating to the destination page.
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
  - **context**: [`app/(main)/library/playlist/[id].tsx`](./app/(main)/library/playlist/[id].tsx) currently fetches playlist songs from the network on every view open.
  - **task**: persist playlist songs into local sqlite during sync and cache on demand so playlist details open instantly and can be browsed offline.

- [ ] **artist and album deep links across the app**
  - **task**: audit all views displaying artist or album text ([`app/player.tsx`](./app/player.tsx), track list items, mini-player, queue):
    - make artist name clickable &rarr; routes directly to `/library/artist/[id]`.
    - make album name clickable &rarr; routes directly to `/library/album/[id]`.

---

## 4. settings, home customization & changelog

- [ ] **reorderable and hideable home page sections**
  - **context**: home page sections are currently statically mapped in [`components/home/index.ts`](./components/home/index.ts).
  - **task**: add a settings screen to reorder home sections via drag-and-drop and toggle visibility on/off, persisted to local preferences.

- [x] **in-app changelog dialogs**
  - **task**: 
    - [x] **settings access**: make the version number in settings clickable to show the full changelog modal with current version open and previous versions in closed accordions ([`components/ChangelogModal.tsx`](./components/ChangelogModal.tsx)).
    - [x] **first-launch post-update**: detect version code increase on launch and display a "what's new" changelog modal automatically once ([`app/_layout.tsx`](./app/_layout.tsx)).

- [ ] **continuous ui/ux iteration**
  - **task**: ongoing refinement of tactile feedback, padding consistency, dark mode contrast, accessibility labels, and touch targets across all screens.

---

## 5. network resilience & offline experience (pre-v2)

- [ ] **alternate / fallback server urls (pre-v2 requirement)**
  - **context**: users running split-dns or separate local and external domain setups require automated fallback.
  - **task**: add primary and secondary fallback server urls in settings and [`services/api.ts`](./services/api.ts) with ping verification and automatic failover on network timeouts.

- [ ] **graceful offline error feedback**
  - **context**: cached songs play locally and library metadata is stored in sqlite. offline playback operates without network dependency.
  - **task**:
    - show non-blocking snackbars when an action requires internet (e.g. streaming an uncached song or triggering manual library sync while disconnected).
    - ensure no intrusive blocking modal or unwanted global state flips occur during transient connection drops.

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
  - **context**: bulk song caching ([`services/songCache.ts`](./services/songCache.ts)) and library sync ([`app/(main)/sync.tsx`](./app/(main)/sync.tsx)) currently run in the javascript runtime. if the user navigates away, locks the screen, or the app process is suspended by the os, downloads fail or stall unpredictably.
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

- [ ] **separate development build variant (side-by-side install)**
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
