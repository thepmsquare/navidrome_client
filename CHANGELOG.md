# changelog

## 2.28.0+63

### user release notes

- add recent searches to search page.

### internal notes

## 2.27.0+62

### user release notes

- add pull to refresh on the following screens: home (updated logic), library (all nested screens), sync
- change the icon on home screen for random albums and random tracks sections to shuffle.

### internal notes

## 2.26.0+61

### user release notes

- add navigation from music player to artist / albums page.
- add alternative urls inputs on connect screen.

### internal notes

- show connected url on stage 2 of connect screen and sync screen.
- add pingFastestServer function to select fastest server from all available urls, also acts as a check if atleast any 1 is connected.
- updates to android specific activity states.
- new permission ask on download for notifications.
- untrack changelog.json asset.
- migration for serverUrls in secure storage.

## 2.25.0+60

### user release notes

- add ui for library > artists > details.
- add pull to refresh feature in home page.

### internal notes

- after tapping on artist name on search page navigates to artist details page.
- add filter option in searchbar inside artists page to hide empty artist entries.

## 2.24.0+59

### user release notes

- add ui to display changelog in app.

### internal notes

- remove constants.json, changes to make constants have SSOT.
- update changelog format.
- add scripts to validate changelog, and perform validations before internal releases.
- update ci cd to trigger on git tags instead of flag from changelog.
- add script to have separate app for development environment (co-exist with app from releases).

## 2.23.0+58

### user release notes

- add random albums, newly added albums and recently released albums sections on homepage.

### internal notes

- ui tweaks.

## 2.22.2+57

### user release notes

- stabilise import / export profile functionality.

### internal notes

- update tests for export, import profile.

## 2.22.1+56

### user release notes

- fixes in import / export profile functionality.

### internal notes

- sync newly added settings to be exported during export, import profile.

## 2.22.0+55

### user release notes

- music player page redesign.
- move over sync stats to sync page.

### internal notes

- bug fixes and redesign library syncing.

## 2.21.2+54

### user release notes

- improve app stability.

### internal notes

- remove circular imports, add checks for mounts.

## 2.21.1+53

### user release notes

- bug fixes in shuffle mode.

## 2.21.0+52

### user release notes

- add shuffle mode.

## 2.20.1+51

### user release notes

- make home screen sections update more frequently.

### internal notes

- add refreshPlayStats function that syncs stats for recent and frequent album plays.

## 2.20.0+50

### user release notes

- add lyrics support.

### internal notes

- move bottom navigation in seperate component.

## 2.19.0+49

### user release notes

- move over sections from homepage to settings page.
- add most played, recently played albums and random tracks sections on homepage.

### internal notes

- refactor albums page be on root instead of inside library for streamlined navigation.

## 2.18.0+48

### user release notes

- experimental release.
- add click to open album art in music player page.

## 2.17.0+47

### user release notes

- add swipe to refresh in playlist details page.
- add sleep timer.

## 2.16.1+46

### user release notes

- bug fixes in bulk download.

## 2.16.0+45

### user release notes

- add search and sort options in library -> albums, library -> artists, library -> playlists.
- add "save to files" option for songs in music player page.
- add option to star songs and set ratings in music player page.

### internal notes

- bug fix in fetching album art.
- add utils for star / ratings.
- update test cases.

## 2.15.2+44

### user release notes

- display app version number on settings page.

## 2.15.1+43

### user release notes

- add offline scrobble queue.

### internal notes

- fixes in scrobble logic.

## 2.15.0+42

### user release notes

- add setting to continue playback when app is discarded. (default: false)
- fix repeat all mode not working.
- tapping on notification now opens the app.

### internal notes

- fixes in playback logic.
- better audio focus handling.
- add artwork caching for the notification service.
- move playback state from memory to sqlite.
- update test cases for playback.

## 2.14.1+41

### user release notes

- bug fixes in scrobble.

## 2.14.0+40

### user release notes

- implement universal search page.
- add fuzzy search.

### internal notes

- refactor search in library -> songs to use same functions as universal search page.

## 2.13.0+39

### user release notes

- add play icon on album and playlist details page.

### internal notes

- fixes in test audio.
- update test cases for playback.

## 2.12.0+38

### user release notes

- add visual indicators in album and playlist details page per song if available offline.
- playlists and albums now have option to bulk "make available offline" (incomplete).
- new download queue screen (incomplete).
- add settings for scrobble section.
- update scrobble logic.

### internal notes

- add option to the cacheButton with mini variant to hide if uncached.
- new BulkSongCacheButton reusable component.
- update the icon for temporary available offline.
- add tests for cache-related services.

## 2.11.0+37

### user release notes

- ui tweaks on all pages.
- bug fixes in logout functionality.
- implement auto caching songs.
- add settings to set limit or stop auto caching.
- add new section in library to list "available offline songs".

### internal notes

- add test cases for all services.

## 2.10.0+36

### user release notes

- update ui for connect screen stage 2.
- add "new to navidrome?" section on connect screen.
- add learn more page.
- add demo mode.

## 2.9.0+35

### user release notes

- update ui for connect screen.
- add import profile functionality on connect screen.

### internal notes

- make changes to audio playback foreground service to fix ANR.
- add test cases for import and export.

## 2.8.0+34

### user release notes

- move logout to settings page.
- add export button in settings page.
- manually cache songs on music player page (and remove from cache).
- playing songs from cache and steam will have different colors in the music players.

### internal notes

- add seperate reusable component for cacheButton with mini variant.
- add layout file for auth group to fix warnings.
- player service now looks for cached songs to play from file instead of steam if available.
- cacheButton component has a progress bar for cache progress with cancel button.
- cacheButton component when manually cached will allow to remove the song from cache.
- add a switchToRemoteStream function if any playback error occurs while playing a cached file.
- add test cases for player and caching.

## 2.7.0+33

### user release notes

- add unit test cases.
- add in app player.

## 2.6.1+32

### user release notes

- add loading bar before opening library sub screens.

## 2.6.0+31

### user release notes

- add in app mini player.

## 2.5.0+30

### user release notes

- bug fixes in audio-playback module.
- add utils for repeat modes.
- add AudioPlaybackService that enables audio to play for more than 3 mins in the background.

## 2.4.0+29

### user release notes

- add util for getPlaylists and getPlaylistDetails.
- add db table for playlists.
- add playlists button, list playlists page and playlist details page in library.
- navigation bug fix for home screen.
- add native audio playback module.
- remove expo-audio dependency.

## 2.3.0+28

### user release notes

- add album details page in library.
- add test sound button on homepage.
- add util and display for active default audio device on homepage.

## 2.2.0+27

### user release notes

- start adding playback queue for songs.

## 2.1.0+26

### user release notes

- add scrobble util and integrate it to song play.

## 2.0.0+25

### user release notes

- complete app reset.

## 1.3.2+24

### user release notes

- remove extra sentry logs.
- improve checks for no internet.

## 1.3.1+23

### user release notes

- remove alternative server urls from connect page and add them to settings.
- add test option to server urls in settings page.

## 1.3.0+22

### user release notes

- add option for alternative server urls for fall back

## 1.2.0+21

### user release notes

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

### user release notes

- swipe up on music player page to see current song queue.
- redesign library page.
- bug fix: album art on music player page now correctly matches the current song.
- integrate material 3 expressive navigation bar, buttons, sliders, pull-to-refresh, and loading indicators.

## 1.0.0+19

### user release notes

- bug fix: fix issue when tapping play twice on an track, player would skip the song.
- bug fix: mini player now in sync with current playing song.
- redesign homepage for offline mode.
- bug fix: offline / no internet banner UI fixes.
- bug fix: no internet now does not auto toggle offline mode.
- redesign sync page for offline mode.

### internal notes

- bug fix: playback sync issue when app goes in background and brought back to foreground no longer interrupts playback.
- bug fix: prevent play and download buttons from overlapping back button on scroll in album, playlist, and artist details pages.

## 1.0.0+18

### user release notes

- add option to quick view lyrics if available.
- rename download songs to save offline across the app.
- add actual "download song" option in music player page to save songs in file system.

## 1.0.0+17

### user release notes

- update whats new widget to show previous release notes.
- add close icon on lyrics page.

## 1.0.0+16

### user release notes

- fix bug that autoplays music on startup.

## 1.0.0+15

### user release notes

- fix logout functionality.
- save lyrics offline on saving songs offline.
- add custom multi-tap detection for media buttons (earphone double/triple taps).
- no internet and offline mode are now separate states.

## 1.0.0+14

### user release notes

- add list of songs being played on other devices in the sync page. (experimental).
- add support to reorder and hide sections in home page.
- implement fuzzy search across the app.
- add recently played albums section to the homepage.

## 1.0.0+13

### user release notes

- add padding bottom to settings page.
- simplify settings by moving common options into submenus (offline saves and advanced).
- update default: 'stop playback on task removal' is now on by default.
- make the version number in settings page clickable to show changelog.
- add a placeholder sync page to explore cross-device playback synchronization.

## 1.0.0+12

### user release notes

- minor improvement in animation in player and mini player again.
- remove artist navigation through chips on all places expect music player.

## 1.0.0+11

### user release notes

- bug fix: stop music play on log out.
- cache network images and other performance tweaks.
- remove offline mode from profile exports.
- add auto-save offline played songs with configurable storage cap and lru eviction (both on by default).
- bug fix: prevent playback from stopping on unlock after a song transition while locked.

## 1.0.0+10

### user release notes

- minor improvement in animation in player and mini player.
- add links for artist and albums in multiple places.
- add play button in artists page.
- fix padding of play button in album and playlists page.

## 1.0.0+9

### user release notes

- add lyrics page and integrate lrclib.
- add artists page in library.
- add demo mode for google play review.
- integrate sentry for error tracking and performance monitoring.
- update button placement in player page.

## 1.0.0+8

### user release notes

- add universal search tab.
- fix navigation issues within application.
- add like and rating options in media player.
- start doing swipe gestures on player page.

## 1.0.0+7

### user release notes

- add import / export server config.
- add version number in settings

## 1.0.0+6

### user release notes

- update icons.
- update connect screen.

## 1.0.0+5

### user release notes

- add song queue screen.
- add shuffle and repeat functionality.

## 1.0.0+4

### user release notes

- add controls to miniplayer.
- make media player page sizing dynamic.

## 1.0.0+3

### user release notes

- add settings toggle to stop playback on discarding bg task.

## 1.0.0+2

### user release notes

- add sorting options

## 1.0.0+1

### user release notes

- initial project commit
