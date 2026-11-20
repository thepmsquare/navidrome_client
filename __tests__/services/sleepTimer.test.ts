import * as audioPlayback from "@/modules/audio-playback";
import {
  cancelSleepTimer,
  getSleepTimerState,
  handlePlaybackStopped,
  handleTrackEnded,
  registerPauseExecutor,
  setDurationTimer,
  setEndOfTrackTimer,
  subscribeSleepTimer,
  syncSleepTimer,
} from "@/services/sleepTimer";
import { AppState } from "react-native";

let expiredListenerCb: (() => void) | null = null;
let appStateChangeCb: ((state: string) => void) | null = null;

jest.mock("@/modules/audio-playback", () => ({
  setSleepTimer: jest.fn().mockResolvedValue(undefined),
  cancelSleepTimer: jest.fn().mockResolvedValue(undefined),
  getSleepTimerRemainingSeconds: jest.fn().mockResolvedValue(0),
  addSleepTimerExpiredListener: jest.fn((cb) => {
    expiredListenerCb = cb;
    return {
      remove: jest.fn(() => {
        expiredListenerCb = null;
      }),
    };
  }),
}));

describe("sleepTimer service", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    cancelSleepTimer();
    jest.clearAllMocks();

    // Capture AppState listener
    (AppState.addEventListener as jest.Mock).mockImplementation((event, cb) => {
      if (event === "change") {
        appStateChangeCb = cb;
      }
      return {
        remove: jest.fn(() => {
          appStateChangeCb = null;
        }),
      };
    });
  });

  afterEach(() => {
    cancelSleepTimer();
    jest.useRealTimers();
  });

  it("should initialize in inactive state", () => {
    const state = getSleepTimerState();
    expect(state.isActive).toBe(false);
    expect(state.mode).toBeNull();
    expect(state.targetTimestamp).toBeNull();
    expect(state.remainingSeconds).toBe(0);
  });

  it("should set duration timer, notify listeners, and schedule native sleep timer", () => {
    const listener = jest.fn();
    const unsubscribe = subscribeSleepTimer(listener);

    // Initial call from subscribe
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ isActive: false }),
    );

    setDurationTimer(15);

    const state = getSleepTimerState();
    expect(state.isActive).toBe(true);
    expect(state.mode).toBe("duration");
    expect(state.remainingSeconds).toBe(15 * 60);
    expect(state.targetTimestamp).toBeGreaterThan(Date.now());
    expect(audioPlayback.setSleepTimer).toHaveBeenCalledWith(15 * 60 * 1000);

    unsubscribe();
  });

  it("should cancel duration timer if minutes <= 0", () => {
    setDurationTimer(10);
    expect(getSleepTimerState().isActive).toBe(true);

    setDurationTimer(0);
    expect(getSleepTimerState().isActive).toBe(false);
    expect(audioPlayback.cancelSleepTimer).toHaveBeenCalled();
  });

  it("should count down and pause playback on expiry", async () => {
    const mockPause = jest.fn().mockResolvedValue(undefined);
    registerPauseExecutor(mockPause);

    setDurationTimer(1); // 60 seconds
    expect(getSleepTimerState().remainingSeconds).toBe(60);

    // Advance 30 seconds
    jest.advanceTimersByTime(30000);
    expect(getSleepTimerState().remainingSeconds).toBe(30);
    expect(mockPause).not.toHaveBeenCalled();

    // Advance remaining 30 seconds
    jest.advanceTimersByTime(30000);

    expect(getSleepTimerState().isActive).toBe(false);
    expect(getSleepTimerState().remainingSeconds).toBe(0);
    expect(mockPause).toHaveBeenCalledTimes(1);
    expect(audioPlayback.cancelSleepTimer).toHaveBeenCalled();
  });

  it("should cancel active timer cleanly and call native cancel", () => {
    const mockPause = jest.fn().mockResolvedValue(undefined);
    registerPauseExecutor(mockPause);

    setDurationTimer(15);
    expect(getSleepTimerState().isActive).toBe(true);

    cancelSleepTimer();
    const state = getSleepTimerState();
    expect(state.isActive).toBe(false);
    expect(state.mode).toBeNull();
    expect(state.remainingSeconds).toBe(0);
    expect(audioPlayback.cancelSleepTimer).toHaveBeenCalled();

    // Advancing timers should not trigger pause
    jest.advanceTimersByTime(20 * 60 * 1000);
    expect(mockPause).not.toHaveBeenCalled();
  });

  it("should handle end-of-track timer mode", async () => {
    const mockPause = jest.fn().mockResolvedValue(undefined);
    registerPauseExecutor(mockPause);

    setEndOfTrackTimer();
    const state = getSleepTimerState();
    expect(state.isActive).toBe(true);
    expect(state.mode).toBe("end_of_track");
    expect(state.targetTimestamp).toBeNull();
    expect(audioPlayback.cancelSleepTimer).toHaveBeenCalled();

    // When track ends, handleTrackEnded should intercept and pause
    const intercepted = handleTrackEnded();
    expect(intercepted).toBe(true);
    expect(mockPause).toHaveBeenCalledTimes(1);
    expect(getSleepTimerState().isActive).toBe(false);

    // Subsequent track ended calls should not be intercepted
    const secondCall = handleTrackEnded();
    expect(secondCall).toBe(false);
  });

  it("should not intercept track ended when timer is duration mode", () => {
    const mockPause = jest.fn().mockResolvedValue(undefined);
    registerPauseExecutor(mockPause);

    setDurationTimer(10);
    const intercepted = handleTrackEnded();
    expect(intercepted).toBe(false);
    expect(getSleepTimerState().isActive).toBe(true);
  });

  it("should cancel timer when playback is stopped or reset", () => {
    setDurationTimer(15);
    expect(getSleepTimerState().isActive).toBe(true);

    handlePlaybackStopped();
    expect(getSleepTimerState().isActive).toBe(false);
    expect(audioPlayback.cancelSleepTimer).toHaveBeenCalled();
  });

  it("should handle native onSleepTimerExpired event cleanly", () => {
    const mockPause = jest.fn().mockResolvedValue(undefined);
    registerPauseExecutor(mockPause);

    setDurationTimer(15);
    expect(getSleepTimerState().isActive).toBe(true);

    // Native triggers expired event (e.g. from background AudioPlaybackService)
    expect(expiredListenerCb).toBeDefined();
    expiredListenerCb?.();

    expect(getSleepTimerState().isActive).toBe(false);
    expect(getSleepTimerState().remainingSeconds).toBe(0);
    expect(mockPause).toHaveBeenCalledTimes(1);
  });

  it("should synchronize remaining seconds without drift on foreground return", () => {
    const now = Date.now();
    jest.setSystemTime(now);

    setDurationTimer(10); // 10 minutes = 600s
    expect(getSleepTimerState().remainingSeconds).toBe(600);

    // Simulate phone being in background with screen off for 4 minutes (240s)
    // while JS interval was paused/throttled by Doze mode
    jest.setSystemTime(now + 240 * 1000);

    // App returns to foreground
    syncSleepTimer();

    expect(getSleepTimerState().isActive).toBe(true);
    expect(getSleepTimerState().remainingSeconds).toBe(360);
  });

  it("should reset timer to inactive on foreground return if deadline expired in background", () => {
    const now = Date.now();
    jest.setSystemTime(now);
    const mockPause = jest.fn().mockResolvedValue(undefined);
    registerPauseExecutor(mockPause);

    setDurationTimer(5); // 5 minutes = 300s
    expect(getSleepTimerState().remainingSeconds).toBe(300);

    // Simulate app sleeping in background past the 5 minute mark (e.g. 7 minutes)
    jest.setSystemTime(now + 420 * 1000);

    // App returns to foreground
    syncSleepTimer();

    expect(getSleepTimerState().isActive).toBe(false);
    expect(getSleepTimerState().remainingSeconds).toBe(0);
    expect(mockPause).toHaveBeenCalledTimes(1);
  });
});
