# todo

status: `[ ]` todo · `[/]` in progress · `[x]` done

## library & playlists

- [ ] **universal entity components & deep linking across the app** (`ui-2`)
  - **context:** entities (songs, albums, artists, playlists) share tap-to-play/open, standard text overflow/a11y, and a 3-dot / long-press context menu.
  - **task:**
    - [x] audit & surface mapping
    - [x] mini-player streamlining
    - [x] universal song row + context menu
    - [x] universal album components (`<AlbumRow />` / `<AlbumCard />`) across library, search, home, artist detail
    - [x] universal artist & playlist rows (`<ArtistRow />` / `<PlaylistRow />`) across library and search
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

- [ ] **audit & placement of cache button** (`lib-4`)
  - **task:** document every surface where the "make available offline" button should appear (song rows, album, playlist, artist, player, search) and implement the missing placements.

- [ ] **smart playlist creation & modifications** (`lib-5`)
  - **context:** smart playlists dynamically generate track lists based on customizable criteria (e.g. rating, play count, genre, release year, recently added, unplayed). navidrome supports rule-based smart playlists, and local sqlite enables instant query evaluation.
  - **task:**
    - design a smart playlist builder dialog / screen with rule selectors (criteria: genre, artist, rating, year, play count, last played, duration, limit, sort order).
    - support editing and updating rules for existing smart playlists.
    - provide live preview of matching tracks as rules are adjusted.
    - evaluate queries against local sqlite database for instant offline-capable playback.

## offline & network

- [ ] **offline user experience & state transitions** (`off-5`)
  - **task:**
    - mid-stream interruption: pause gracefully with retry or skip to the next cached song.
    - visually differentiate cached vs uncached content while offline.
    - queue offline mutations (star, rating, scrobbles, playlist additions) and replay on reconnect.
    - pause in-flight downloads cleanly on connection drop and resume automatically.
    - reconnect, ping fallback urls, and flush queues without interrupting playback.

- [ ] **global offline mode toggle** (`off-10`)
  - **context:** v1 featured a global "offline mode" toggle in settings and in a top banner. when active, the entire application (home sections, library lists, search) filtered to show only saved offline / cached content, distinct from the transient "no internet" state.
  - **task:** add a global offline mode switch in `app/(main)/settings.tsx` and an offline indicator banner, persist state, and filter home, library screens, and search results to cached media when active.

- [ ] **storage breakdown & cache management screen** (`off-6`)
  - **task:** show disk usage by manual downloads, auto-cache, artwork, and database. sort by artist/album. bulk prune/delete.

- [ ] **incremental / delta library sync** (`off-8`)
  - **context:** [`client_app_sync()`](./services/api.ts) pulls the entire library each sync.
  - **task:** use `getScanStatus` / server scan timestamps to fetch only changed albums and tracks since the last sync.

- [ ] **refresh expo-image cache on force sync** (`off-11`)
  - **context:** [`client_app_sync(true)`](./services/api.ts) triggered by `force sync` in [`app/(main)/sync.tsx`](<./app/(main)/sync.tsx>) does not currently call `Image.clearDiskCache()` or `Image.clearMemoryCache()`, so updated server artwork may stay stale.
  - **task:** clear `expo-image` disk and memory caches (and re-fetch any locally cached offline artwork) when running a force sync.

- [ ] **auto fallback / failover on transport failures** (`net-1`)
  - **context:** alternate server urls are stored and pinged on connect, but runtime requests still target the active url only.
  - **task:** wrap request building so transport failures retry the next candidate url, update the active url on success, and debounce flapping. manual control is tracked as `net-2`.

## settings & ui

- [ ] **customisable notification actions** (`ui-6`)
  - **task:** allow users to customise the media notification action buttons in settings and apply them in the native playback service.

- [ ] **customise chips in music player page** (`ui-7`)
  - **task:** allow users to customise which action/info chips are shown and their order on the music player screen.

- [ ] **tap-to-expand artwork audit across the app** (`ui-8`)
  - **task:** audit all artwork surfaces across the app (album, artist, playlist, player, etc.) and ensure tap-to-expand via `ModalArtViewer` works consistently.

## security

- [ ] **backup export credentials disclosure** (`sec-1`)
  - **context:** [`services/backup.ts`](./services/backup.ts) writes server passwords in plaintext to exported json.
  - **task:** add a warning/disclosure during export. passphrase encryption is tracked as `sec-2`.

- [ ] **backup profile credentials encryption** (`sec-2`)
  - **task:** optional passphrase-based encryption for exported profiles. `sec-1` provides the disclosure.

## architecture & code health

- [ ] **shared entity context sheet** (`ui-3`)
  - **task:** deduplicate `SongContextMenuModal`, `AlbumContextMenuModal`, `ArtistContextMenuModal`, and `PlaylistContextMenuModal` into one configurable sheet. requires all four context menus to exist.

- [ ] **decomposition of monoliths** (`eng-2`)
  - **context:** [`services/db.ts`](./services/db.ts) is ~1,200 lines and [`app/player.tsx`](./app/player.tsx) is ~900 lines.
  - **task:** split the database into domain repositories and extract player sub-components into dedicated modules.

- [ ] **performance & render optimization** (`eng-3`)
  - **task:** profile list rendering (`getItemLayout`, window size, memoization), tune `expo-image` cache, and reduce re-renders from player and download progress.

- [ ] **in-app event log viewer & export** (`dbg-1`)
  - **context:** v1 provided a dedicated event log screen (`event_log_page.dart`) displaying timestamped log entries across `debug`, `info`, `warning`, and `error` levels, formatted stack traces, level filtering, and one-tap copy/share to clipboard. currently play vitals only surfaces native crashes and anrs.
  - **task:** maintain a bounded ring buffer of events, network diagnostics, and js errors in sqlite, create an in-app event log viewer screen with search and level filters, allow copying formatted logs to clipboard, and expose "view event log" and "export debug logs" in settings.

## release & testing

- [ ] **f-droid release pipeline** (`ci-5`)
  - **task:** set up reproducible builds, fastlane metadata, and an automated pipeline to publish releases to f-droid.

- [ ] **store listing & compliance** (`store-1`)
  - **task:** update the play store listing (description, screenshots, feature graphic), data safety form, and content rating. confirm [`privacy_policy.html`](./privacy_policy.html) is published.

- [ ] **final privacy & data-safety review** (`store-3`)
  - **task:** re-check the data safety form against the shipped build (network calls, local storage, exports) and confirm the privacy policy covers everything.

- [ ] **staged rollout** (`rel-1`)
  - **task:** roll out 10% → 50% → 100% while monitoring vitals and crash reports.

## ongoing

- [ ] **continuous ui/ux refinements** (`eng-5`)
  - **task:** haptics, spacing, typography, dark-mode contrast, route animations, and touch targets.

- [ ] **silent exception swallowing audit** (`eng-1`)
  - **task:** replace empty `catch { }` blocks across services with structured `console.error` logging. apply incrementally when the affected files are modified.

- [ ] **ongoing profile export & import settings audit** (`eng-6`)
  - **context:** as new settings are added, [`services/backup.ts`](./services/backup.ts) needs to stay in sync so newly introduced preferences are exported and restored.
  - **task:** regularly audit all persisted app settings and ensure any new options are included in profile export/import with safe defaults.

## future

- [ ] **local network server auto-discovery (mdns / ssdp)** (`future-1`)
- [ ] **shareable guest song links (`createShare`)** (`future-2`)
- [ ] **cross-device now playing queue takeover & remote control** (`future-3`)
  - **context:** v1 included an experimental cross-device session viewer (`sync_page.dart`) that periodically polled `getNowPlaying()`, identified active sessions for the same user on other clients (web, desktop, or mobile), and displayed the active track, artist, and player name. tapping a session fetched `getPlayQueue()` and `positionMs` (OpenSubsonic extension) to immediately adopt that remote queue and seek to the active position locally.
  - **task:** build a session viewer to discover active sessions on other clients for the current account, adopt remote queues and position timestamps via the Subsonic API for seamless playback handover, and expand into full remote playback control.
- [ ] **synchronized group listening ("jam" sessions)** (`future-4`)
- [ ] **server statistics & analytics dashboard** (`future-5`)
- [ ] **pre auto-caching of next song** (`future-6`)
  - **consideration:** evaluate pre auto-caching the upcoming queue track during active playback or exoplayer pre-buffering while respecting wi-fi restrictions and cache size limits.
- [ ] **pinned section on home screen** (`future-7`)
  - **task:** add a pinned section on the home page with context menu actions ("pin to home" / "unpin from home") across album, track, playlist, and artist entities.
- [ ] **generate & export wrapped-style listening recap** (`future-8`)
  - **task:** generate shareable wrapped-style listening recaps (top artists, albums, tracks, genres, listening time) and export them as images or cards.
