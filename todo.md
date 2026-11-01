# roadmap & release readiness

technical roadmap for the v2.0 public release and subsequent 2.x iterations. this file is **gate-driven**: only items under a release gate can block a release. everything else is fast-follow work that can be pulled forward opportunistically.

status legend: `[ ]` todo · `[/]` in progress · `[x]` done
release path: **closed beta → open beta → production (staged rollout)**

how this file works:
- gates have binary exit criteria. a release ships when the criteria are met, not when the list is empty.
- non-gating work may be done at any time, including between gate items.
- nothing new enters a gate without moving that gate's target date.
- weekly review: items may move down freely. moving up requires a date slip.
- p0 = data loss, login loop, playback crash. only p0s block a gate.
- estimates assume ~30–60 min/day, 6–8 meaningful commits/week.

---

## current sprint (nov 2–8, 2026)

- [ ] `ui-2` artist row + context menu, wired into the artists library and search
- [ ] `ui-2` playlist row + context menu, wired into the playlists library and search
- [ ] `ui-2` song row for download queue and pending scrobbles
- [ ] `net-2` server url management screen (view / test ping / switch / add / remove)

detailed context under §4.

---

## release gates

### gate 1 — closed beta (target: nov 22, 2026)

exit criteria:
- a v1 flutter user upgrading through play keeps credentials, settings, and downloaded cache.
- migration failures fall back to the connect screen. no crash loop.
- closed-track upload is automated and a `release/v2.0` branch exists.
- manual upgrade smoke test passes on a physical device.

gated by: `mig-0`, `mig-1`, `mig-2`, `mig-3`, `db-1`, `ci-1`, `qa-1`

### gate 2 — open beta (target: mid-december 2026)

exit criteria:
- open testing track is live with listing, screenshots, data safety, and privacy policy.
- crashes and anrs are readable in play console (r8 mapping + native symbols uploaded).
- two weeks of closed beta with no p0.

gated by: `store-1`, `store-2`, `ci-2`
quality work (can slip without moving the date): `pb-1`, `pb-2`, `off-1`, `off-2`, `off-3`

note: if the play developer account is new, the 12-tester / 14-day closed testing requirement runs in parallel with gate 2 work. start the clock as soon as gate 1 is green.

### gate 3 — production (target: late january 2027)

exit criteria:
- production lane supports staged rollout.
- two weeks of open beta with no p0.
- privacy and data-safety review complete.

gated by: `ci-3`, `sec-1`, `store-3`, `rel-1`

at current pace, a scoped v2 public release lands around january 2027. the non-gating backlog extends into q2 2027.

---

## 1. closed beta work (gate 1)

### `mig-0` verify the v1 → v2 upgrade path
- **context:** migration only works if v2 can upgrade the installed v1 app in place. that requires the same `applicationId` (`com.thepmsquare.navidrome_client`) and the same play app signing key.
- **task:** confirm the legacy flutter app shipped with the same package id and signing key. test through the play internal track — a locally built apk cannot upgrade a play-installed app because play re-signs it.
- **note:** if this fails, migration is impossible and beta becomes fresh-install only. do this before writing any migration code.

### `mig-1` credentials & session auto-migration
- **context:** legacy builds stored credentials in android `SharedPreferences` (`flutter.server_url`, `flutter.username`, `flutter.password`). v2 uses [`expo-secure-store`](./services/backup.ts).
- **task:** create a one-time startup routine that checks for legacy shared preferences, imports credentials into secure store, and marks migration complete to avoid forcing users to re-login.

### `mig-2` settings migration & safe fallbacks
- **context:** legacy preferences (`stop_playback_on_task_removed`, `auto_save_offline_played`, `home_sections`) were serialized in shared preferences.
- **task:** import legacy settings keys into sqlite on first run. all missing keys must gracefully fall back to defaults.

### `mig-3` migration safety & idempotency
- **task:** make every migration step idempotent and failure-safe. a failed migration must log and fall back to the connect screen — never crash-loop or wipe existing data. gate the whole routine behind a single "migration complete" flag.

### `db-1` sqlite schema versioning & migration runner
- **context:** [`services/db.ts`](./services/db.ts) initializes tables using `CREATE TABLE IF NOT EXISTS` without schema version tracking. future schema changes will fail to apply to existing databases.
- **task:** implement a versioned migration runner using `PRAGMA user_version` to apply incremental `ALTER TABLE` and schema migrations reliably across updates. bundle with `mig-1` / `mig-2` since all three touch startup and storage.

### `ci-1` closed testing track automation + release branch
- **task:** add `.github/workflows/release-closed.yml` and fastlane lane `upload_closed` for alpha/beta test groups. create `release/v2.0` for stabilization before merging to main.

### `qa-1` upgrade smoke test
- **task:** install v1 from play on a physical device with a real library, upgrade to the v2 internal build, and verify: login state preserved, library syncs, settings intact, downloaded songs still play offline, playback and scrobbling work.

---

## 2. open beta work (gate 2)

### `pb-1` audio focus ducking & transient loss recovery
- **context:** `setHandleAudioBecomingNoisy(true)` handles headphone disconnects, but transient focus losses (navigation prompts, alarms, calls) need explicit ducking and pause/resume logic.
- **task:** audit transient vs exclusive focus loss in `AudioPlaybackService.kt`. duck volume during transient loss; pause and resume cleanly after calls.

### `pb-2` resumable playback after notification dismissal
- **context:** tapping the close icon on the android media notification stops the native playback service. returning to the app leaves the mini player visible, but play fails to resume.
- **task:** audit the player state lifecycle when the notification is closed. either re-instantiate the audio session from the current track on play, or hide the mini player when playback is closed.

### `off-1` persist album art for offline cached songs
- **context:** [`services/songCache.ts`](./services/songCache.ts) saves audio but not artwork, so covers are missing offline.
- **task:** download and persist cover art alongside cached songs, and resolve cached covers before network urls.

### `off-2` graceful offline error feedback
- **task:** show non-blocking snackbars when an action needs internet (streaming an uncached song, manual sync while offline). no blocking modals or global state flips during transient drops.

### `off-3` cheap download survival mitigation
- **context:** bulk caching runs in the js runtime and stalls when the app is backgrounded. a proper foreground service is tracked as `off-4` in §4.
- **task:** keep the screen awake during active downloads and show a "keep the app open" banner. rely on the existing `resumePendingDownloadsAfterRestart()` for process death.

### `store-1` store listing & compliance
- **task:** complete the play store listing (description, screenshots, feature graphic), data safety form, content rating, and confirm [`privacy_policy.html`](./privacy_policy.html) is published. fastlane currently skips images and screenshots.

### `store-2` crash visibility without sentry
- **context:** no sentry by design. play console android vitals is the crash/anr source of truth.
- **task:** upload the r8 mapping file and native debug symbols during release builds so vitals show readable stack traces.

### `ci-2` open testing track automation
- **task:** add `.github/workflows/release-open.yml` and fastlane lane `upload_open`.

---

## 3. production work (gate 3)

### `ci-3` production track automation with staged rollout
- **task:** add `.github/workflows/release-prod.yml` and fastlane lane `upload_production` with staged rollout percentages (e.g. 10%, 20%, 50%, 100%).

### `sec-1` backup export credentials disclosure
- **context:** [`services/backup.ts`](./services/backup.ts) writes server passwords in plaintext to exported json.
- **task:** add a clear warning/disclosure during export. passphrase encryption is tracked as `sec-2` in §4.

### `store-3` final privacy & data-safety review
- **task:** re-check the data safety form against the shipped build (network calls, local storage, exports) and confirm the privacy policy covers everything.

### `rel-1` staged rollout execution
- **task:** roll out 10% → 50% → 100% on the production track while monitoring vitals and p0 reports.

---

## 4. non-gating work (2.x fast follow)

these items are valuable but never block a release. pull them forward when a week has room.

### `ui-2` universal entity components & deep linking across the app
- **context:** entities (songs, albums, artists, playlists) share tap-to-play/open, standard text overflow/a11y, and a 3-dot / long-press context menu.
- **task:**
  - [x] audit & surface mapping
  - [x] mini-player streamlining
  - [x] universal song row + context menu
  - [x] universal album components (`<AlbumRow />` / `<AlbumCard />`) across library, search, home, artist detail
  - [/] universal artist & playlist rows (`<ArtistRow />` / `<PlaylistRow />`) across library and search (this week)
  - [/] specialized song list extensibility for download queue and pending scrobbles (this week)

### `ui-1` reorderable and hideable home page sections
- **context:** home sections are statically mapped in [`components/home/index.ts`](./components/home/index.ts).
- **task:** settings screen to reorder via drag-and-drop and toggle visibility, persisted locally.

### `ui-3` shared entity context sheet (optional)
- **task:** deduplicate `SongContextMenuModal`, `AlbumContextMenuModal`, `ArtistContextMenuModal`, and `PlaylistContextMenuModal` into one configurable sheet. only worth it once all four exist.

### `lib-1` playlist management & mutations
- **context:** only read paths exist (`getPlaylists`, `getPlaylist`). there is no create/update/delete api or ui.
- **task:**
  - create new playlist dialog.
  - "add to playlist" from song menus across player and library.
  - remove songs from a playlist.
  - reorder songs within a playlist (`updatePlaylist`).
  - delete playlist.

### `lib-2` playlist details local caching
- **context:** [`app/(main)/library/playlist/[id].tsx`](<./app/(main)/library/playlist/[id].tsx>) fetches songs from the network on every open.
- **task:** persist playlist songs into sqlite during sync and cache on demand so details open instantly and browse offline.

### `lib-3` starred / favorites screen
- **task:** `app/(main)/library/starred.tsx` with tabs/filters for starred songs, albums, and artists, integrated with subsonic `getStarred` and local sqlite.

### `lib-4` audit & placement of cache button
- **task:** document every surface where the "make available offline" button should appear (song rows, album, playlist, artist, player, search) and fill the gaps.

### `off-4` android foreground service for downloads & sync
- **context:** bulk caching and library sync run in the js runtime and stall when the app is suspended.
- **task:** attach downloads and sync to a foreground service / workmanager with an ongoing notification showing progress, counts, and cancel.

### `off-5` offline user experience & state transitions
- **task:**
  - mid-stream interruption: pause gracefully with retry or skip to the next cached song.
  - visually differentiate cached vs uncached content while offline.
  - queue offline mutations (star, rating, scrobbles, playlist additions) and replay on reconnect.
  - pause in-flight downloads cleanly on connection drop and resume automatically.
  - reconnect, ping fallback urls, and flush queues without interrupting playback.

### `off-6` storage breakdown & cache management screen
- **task:** show disk usage by manual downloads, auto-cache, artwork, and database. sort by artist/album. bulk prune/delete.

### `off-7` download over wi-fi only toggle
- **task:** pause queued caching on cellular connections.

### `off-8` incremental / delta library sync
- **context:** [`client_app_sync()`](./services/api.ts) pulls the entire library each sync.
- **task:** use `getScanStatus` / server scan timestamps to fetch only changed albums and tracks since the last sync.

### `off-9` orphaned legacy cache cleanup
- **context:** legacy downloads live in `<app_dir>/app_flutter/offline/{tracks,covers,lyrics,meta}`. v2 uses `manual-cache` and `auto-cache`.
- **task:** detect legacy directories on launch and offer cleanup to reclaim disk space. cheap to add while `mig-*` is in flight.

### `net-1` auto fallback / failover on transport failures
- **context:** alternate server urls are stored and pinged on connect, but runtime requests still target the active url only.
- **task:** wrap request building so transport failures retry the next candidate url, update the active url on success, and debounce flapping. manual control lives in `net-2`.

### `net-2` server url management screen
- **context:** partially complete. connect-screen inputs, parallel ping, winner selection, backup compatibility, and startup backfill are done.
- **task:**
  - [/] view saved urls, active badge, latency, and test ping.
  - [ ] switch active url without logging out.
  - [ ] add/remove urls (keep at least one, block removing the active one).
  - [ ] reorder urls (priority order for `net-1`).

### `pb-3` gapless playback
- **context:** native exoplayer loads one track at a time, causing brief silence between songs.
- **task:** pre-buffer the upcoming `MediaItem` into exoplayer's native playlist sequence.

### `pb-4` sleep timer gradual fade-out
- **context:** [`services/sleepTimer.ts`](./services/sleepTimer.ts) pauses abruptly.
- **task:** ramp volume down over the final 30–60 seconds.

### `arch-1` js and native audio state synchronization
- **context:** [`services/player.ts`](./services/player.ts) relies on module-level mutable state. activity recreation can desynchronize js from native playback.
- **task:** treat the native audio module as authoritative on launch and resume. sync active track and status into js.

### `sec-2` backup profile credentials encryption
- **task:** optional passphrase-based encryption for exported profiles. `sec-1` ships the disclosure first.

### `dbg-1` local js error log + export
- **context:** no sentry by design. play vitals only surfaces native crashes and anrs.
- **task:** keep a bounded ring buffer of js errors in sqlite and expose "export debug logs" in settings.

---

## 5. engineering hygiene (continuous, never gates)

### `eng-1` silent exception swallowing audit
- **task:** replace empty `catch { }` blocks across services with structured `console.error` logging. do this opportunistically when touching a file.

### `eng-2` decomposition of monoliths
- **context:** [`services/db.ts`](./services/db.ts) is ~1,200 lines and [`app/player.tsx`](./app/player.tsx) is ~900 lines.
- **task:** split the database into domain repositories and extract player sub-components into dedicated modules.

### `eng-3` performance & render optimization
- **task:** profile list rendering (`getItemLayout`, window size, memoization), tune `expo-image` cache, and reduce re-renders from player and download progress.

### `eng-4` build pipeline optimization
- **context:** release builds take 20+ minutes because the aab and apk are built separately and gradle caching is absent.
- **task:** build the universal apk from the aab with `bundletool` instead of a second `assembleRelease`, add gradle caching and configuration cache, and enable parallel builds.

### `eng-5` continuous ui/ux refinements
- **task:** haptics, spacing, typography, dark-mode contrast, route animations, and touch targets.

---

## 6. post-2.x (parking lot)

### `future-1` local network server auto-discovery (mdns / ssdp)
### `future-2` shareable guest song links (`createShare`)
### `future-3` remote control for other navidrome clients
### `future-4` synchronized group listening ("jam" sessions)
### `future-5` server statistics & analytics dashboard

---

## appendix: completed

- v1 → v2 profile backup/export compatibility (`navidrome_client_backup` schema).
- playback queue management & ui (`app/queue.tsx`, `components/PlaybackQueueView.tsx`).
- dynamic queue operations in `services/player.ts` (play next, add, remove, clear, move, set).
- interactive seek bar & modular skin (`components/PlayerSeekBar.tsx`).
- bulk offline song caching with progress and cancellation.
- artist details page (`app/artist/[id].tsx`).
- offline filter in search.
- pending scrobbles screen (`app/(main)/library/scrobbles.tsx`).
- pull-to-refresh across screens.
- recent search history.
- in-app changelog dialogs.
- haptic feedback toggle in settings + backup.
- playback speed options (0.75x–2.0x).
- universal album components across library, search, home, artist detail.
- internal testing track automation.
- separate development build variant.
