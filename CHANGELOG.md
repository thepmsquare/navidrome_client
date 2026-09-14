# changelog

## 2.12.0+38 (in progress)

- add visual indicators in album and playlist details page per song if available offline.
- playlists and albums now have option to bulk "make available offline" (incomplete).
- new download queue screen (incomplete).
- technical changes
  - add option to the cacheButton with mini variant to hide if uncached.
  - new BulkSongCacheButton reusable component.
  - update the icon for temporary available offline.
  - add tests for cache-related services.

## 2.11.0+37

- ui tweaks on all pages.
- bug fixes in logout functionality.
- implement auto caching songs.
- add settings to set limit or stop auto caching.
- add new section in library to list "available offline songs".
- technical changes
  - add test cases for all services.

## 2.10.0+36

- update ui for connect screen stage 2.
- add "new to navidrome?" section on connect screen.
- add learn more page.
- add demo mode.

## 2.9.0+35

- update ui for connect screen.
- add import profile functionality on connect screen.
- technical changes
  - make changes to audio playback foreground service to fix ANR.
  - add test cases for import and export.

## 2.8.0+34

- move logout to settings page.
- add export button in settings page.
- manually cache songs on music player page (and remove from cache).
- playing songs from cache and steam will have different colors in the music players.
- technical changes
  - add seperate reusable component for cacheButton with mini variant.
  - add layout file for auth group to fix warnings.
  - player service now looks for cached songs to play from file instead of steam if available.
  - cacheButton component has a progress bar for cache progress with cancel button.
  - cacheButton component when manually cached will allow to remove the song from cache.
  - add a switchToRemoteStream function if any playback error occurs while playing a cached file.
  - add test cases for player and caching.

## 2.7.0+33

- add unit test cases.
- add in app player.

## 2.6.1+32

- add loading bar before opening library sub screens.

## 2.6.0+31

- add in app mini player.

## 2.5.0+30

- bug fixes in audio-playback module.
- add utils for repeat modes.
- add AudioPlaybackService that enables audio to play for more than 3 mins in the background.

## 2.4.0+29

- add util for getPlaylists and getPlaylistDetails.
- add db table for playlists.
- add playlists button, list playlists page and playlist details page in library.
- navigation bug fix for home screen.
- add native audio playback module.
- remove expo-audio dependency.

## 2.3.0+28

- add album details page in library.
- add test sound button on homepage.
- add util and display for active default audio device on homepage.

## 2.2.0+27

- start adding playback queue for songs.

## 2.1.0+26

- add scrobble util and integrate it to song play.

## 2.0.0+25

- complete app reset.

## 1.3.2+24

- remove extra sentry logs.
- improve checks for no internet.

## 1.3.1+23

- remove alternative server urls from connect page and add them to settings.
- add test option to server urls in settings page.

## 1.3.0+22

- add option for alternative server urls for fall back

## 1.2.0+21

- add support for random albums, newly added releases, recently released sections to homepage.
- add font selector.
- improve app crash and bug reporting.
- add sleep timer feature in music player page.
- add help page.
- update behavior of next and previous buttons on repeat 1 track mode.
- connect page:
  - clear icon in server url re-adds https prefix.
  - update layout and spacing.
  - add autofill support for password managers.

## 1.1.0+20

- swipe up on music player page to see current song queue.
- redesign library page.
- bug fix: album art on music player page now correctly matches the current song.
- integrate material 3 expressive navigation bar, buttons, sliders, pull-to-refresh, and loading indicators.

## 1.0.0+19

- bug fix: fix issue when tapping play twice on an track, player would skip the song.
- bug fix: mini player now in sync with current playing song.
- redesign homepage for offline mode.
- bug fix: offline / no internet banner UI fixes.
- bug fix: no internet now does not auto toggle offline mode.
- redesign sync page for offline mode.
- bug fix: playback sync issue when app goes in background and brought back to foreground no longer interrupts playback.
- bug fix: prevent play and download buttons from overlapping back button on scroll in album, playlist, and artist details pages.

## 1.0.0+18

- add option to quick view lyrics if available.
- rename download songs to save offline across the app.
- add actual "download song" option in music player page to save songs in file system.

## 1.0.0+17

- update whats new widget to show previous release notes.
- add close icon on lyrics page.

## 1.0.0+16

- fix bug that autoplays music on startup.

## 1.0.0+15

- fix logout functionality.
- save lyrics offline on saving songs offline.
- add custom multi-tap detection for media buttons (earphone double/triple taps).
- no internet and offline mode are now separate states.

## 1.0.0+14

- add list of songs being played on other devices in the sync page. (experimental).
- add support to reorder and hide sections in home page.
- implement fuzzy search across the app.
- add recently played albums section to the homepage.

## 1.0.0+13

- add padding bottom to settings page.
- simplify settings by moving common options into submenus (offline saves and advanced).
- update default: 'stop playback on task removal' is now on by default.
- make the version number in settings page clickable to show changelog.
- add a placeholder sync page to explore cross-device playback synchronization.

## 1.0.0+12

- minor improvement in animation in player and mini player again.
- remove artist navigation through chips on all places expect music player.

## 1.0.0+11

- bug fix: stop music play on log out.
- cache network images and other performance tweaks.
- remove offline mode from profile exports.
- add auto-save offline played songs with configurable storage cap and lru eviction (both on by default).
- bug fix: prevent playback from stopping on unlock after a song transition while locked.

## 1.0.0+10

- minor improvement in animation in player and mini player.
- add links for artist and albums in multiple places.
- add play button in artists page.
- fix padding of play button in album and playlists page.

## 1.0.0+9

- add lyrics page and integrate lrclib.
- add artists page in library.
- add demo mode for google play review.
- integrate sentry for error tracking and performance monitoring.
- update button placement in player page.

## 1.0.0+8

- add universal search tab.
- fix navigation issues within application.
- add like and rating options in media player.
- start doing swipe gestures on player page.

## 1.0.0+7

- add import / export server config.
- add version number in settings

## 1.0.0+6

- update icons.
- update connect screen.

## 1.0.0+5

- add song queue screen.
- add shuffle and repeat functionality.

## 1.0.0+4

- add controls to miniplayer.
- make media player page sizing dynamic.

## 1.0.0+3

- add settings toggle to stop playback on discarding bg task.

## 1.0.0+2

- add sorting options

## 1.0.0+1

- initial project commit
