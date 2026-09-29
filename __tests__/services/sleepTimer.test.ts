import {
  cancelSleepTimer,
  getSleepTimerState,
  handlePlaybackStopped,
  handleTrackEnded,
  registerPauseExecutor,
  setDurationTimer,
  setEndOfTrackTimer,
  subscribeSleepTimer,
} from "@/services/sleepTimer";

describe("sleepTimer service", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    cancelSleepTimer();
    jest.clearAllMocks();
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

  it("should set duration timer and notify listeners", () => {
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

    unsubscribe();
  });

  it("should cancel duration timer if minutes <= 0", () => {
    setDurationTimer(10);
    expect(getSleepTimerState().isActive).toBe(true);

    setDurationTimer(0);
    expect(getSleepTimerState().isActive).toBe(false);
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
  });

  it("should cancel active timer cleanly", () => {
    const mockPause = jest.fn().mockResolvedValue(undefined);
    registerPauseExecutor(mockPause);

    setDurationTimer(15);
    expect(getSleepTimerState().isActive).toBe(true);

    cancelSleepTimer();
    const state = getSleepTimerState();
    expect(state.isActive).toBe(false);
    expect(state.mode).toBeNull();
    expect(state.remainingSeconds).toBe(0);

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
  });
});
