import { useEffect, useState } from "react";

export type SleepTimerMode = "duration" | "end_of_track";

export interface SleepTimerState {
  isActive: boolean;
  mode: SleepTimerMode | null;
  targetTimestamp: number | null;
  remainingSeconds: number;
}

type PauseExecutor = () => Promise<void>;

let pauseExecutor: PauseExecutor | null = null;
let timerInterval: ReturnType<typeof setInterval> | null = null;

let currentState: SleepTimerState = {
  isActive: false,
  mode: null,
  targetTimestamp: null,
  remainingSeconds: 0,
};

const listeners = new Set<(state: SleepTimerState) => void>();

function notifyListeners(): void {
  listeners.forEach((listener) => {
    try {
      listener(currentState);
    } catch (err) {
      console.error("error in sleep timer listener:", err);
    }
  });
}

function clearActiveInterval(): void {
  if (timerInterval !== null) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

export function registerPauseExecutor(executor: PauseExecutor): void {
  pauseExecutor = executor;
}

export function getSleepTimerState(): SleepTimerState {
  return currentState;
}

export function subscribeSleepTimer(
  listener: (state: SleepTimerState) => void,
): () => void {
  listeners.add(listener);
  listener(currentState);
  return () => {
    listeners.delete(listener);
  };
}

export function setDurationTimer(minutes: number): void {
  if (minutes <= 0) {
    cancelSleepTimer();
    return;
  }

  clearActiveInterval();

  const durationMs = Math.round(minutes * 60 * 1000);
  const targetTimestamp = Date.now() + durationMs;
  const initialRemaining = Math.max(
    0,
    Math.ceil((targetTimestamp - Date.now()) / 1000),
  );

  currentState = {
    isActive: true,
    mode: "duration",
    targetTimestamp,
    remainingSeconds: initialRemaining,
  };
  notifyListeners();

  timerInterval = setInterval(() => {
    if (!currentState.isActive || currentState.mode !== "duration") {
      clearActiveInterval();
      return;
    }

    const remaining = Math.max(
      0,
      Math.ceil(((currentState.targetTimestamp ?? 0) - Date.now()) / 1000),
    );

    if (remaining <= 0) {
      clearActiveInterval();
      currentState = {
        isActive: false,
        mode: null,
        targetTimestamp: null,
        remainingSeconds: 0,
      };
      notifyListeners();

      if (pauseExecutor) {
        pauseExecutor().catch((err) =>
          console.error("failed to pause playback on sleep timer expiry:", err),
        );
      }
    } else {
      currentState = {
        ...currentState,
        remainingSeconds: remaining,
      };
      notifyListeners();
    }
  }, 1000);
}

export function setEndOfTrackTimer(): void {
  clearActiveInterval();

  currentState = {
    isActive: true,
    mode: "end_of_track",
    targetTimestamp: null,
    remainingSeconds: 0,
  };
  notifyListeners();
}

export function cancelSleepTimer(): void {
  clearActiveInterval();
  if (currentState.isActive) {
    currentState = {
      isActive: false,
      mode: null,
      targetTimestamp: null,
      remainingSeconds: 0,
    };
    notifyListeners();
  }
}

/**
 * Called by playback service when a track finishes.
 * If end_of_track timer is active, pauses playback and resets timer.
 * Returns true if playback transition was intercepted by sleep timer.
 */
export function handleTrackEnded(): boolean {
  if (currentState.isActive && currentState.mode === "end_of_track") {
    clearActiveInterval();
    currentState = {
      isActive: false,
      mode: null,
      targetTimestamp: null,
      remainingSeconds: 0,
    };
    notifyListeners();

    if (pauseExecutor) {
      pauseExecutor().catch((err) =>
        console.error("failed to pause playback on end-of-track timer:", err),
      );
    }
    return true;
  }
  return false;
}

/**
 * Called when playback naturally ends or player is stopped/reset.
 */
export function handlePlaybackStopped(): void {
  if (currentState.isActive) {
    cancelSleepTimer();
  }
}

export function useSleepTimer(): SleepTimerState {
  const [state, setState] = useState<SleepTimerState>(() => getSleepTimerState());

  useEffect(() => {
    const unsubscribe = subscribeSleepTimer((newState) => {
      setState(newState);
    });
    return unsubscribe;
  }, []);

  return state;
}
