## functional gaps in audio playback

| Area                   | Current State                                                                                                                         | Missing Gap                                                                                 |
| :--------------------- | :------------------------------------------------------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------ |
| **Shuffle Mode**       | Listed in `CHANGELOG.md` (v1.0.0+5), but not in codebase.                                                                             | No shuffle toggle, no randomized queue order, no history tracking.                          |
| **Playback Queue UI**  | Only a "download queue" exists ([`app/(main)/library/queue.tsx`](file:///d:/code/navidrome_client/app/%28main%29/library/queue.tsx)). | No "now playing / up next" screen to view remaining songs, reorder, or remove songs.        |
| **Queue Operations**   | Queue is set all-at-once by [`playPlaylist`](file:///d:/code/navidrome_client/services/player.ts#L360).                               | No "play next", "add to end of queue", "clear queue", or "remove track from queue".         |
| **Seeking Experience** | Tap-to-seek only via [`ProgressBar`](file:///d:/code/navidrome_client/app/player.tsx#L270-L289).                                      | No draggable slider/scrubber, no scrub timestamp preview, no fine-grained timeline control. |
| **Gapless Playback**   | Only 1 song loaded in native ExoPlayer at a time.                                                                                     | Next song is not pre-buffered; causes silence/delay between consecutive tracks.             |
| **Playback Speed**     | Unsupported.                                                                                                                          | No speed control (0.75x, 1x, 1.25x, 1.5x, 2x) for audiobooks/podcasts.                      |
| **Sleep Timer**        | None.                                                                                                                                 | No timer to pause playback after X minutes or at end of current track.                      |
| **Offline Scrobbling** | Drops scrobble if network call fails.                                                                                                 | No persistent scrobble queue to retry submissions when connectivity returns.                |
| **Volume / Gain**      | Native `setVolume` exists, but no UI.                                                                                                 | No volume slider or ReplayGain / normalization support.                                     |

---
