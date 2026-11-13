export interface SnackbarOptions {
  duration?: number;
  actionLabel?: string;
  onAction?: () => void;
}

export interface SnackbarPayload {
  message: string;
  duration: number;
  actionLabel: string;
  onAction?: () => void;
}

export const OFFLINE_ERROR_MESSAGE = "unable to connect to server";

type SnackbarListener = (payload: SnackbarPayload) => void;

const listeners = new Set<SnackbarListener>();

/**
 * Triggers a global non-blocking snackbar message.
 */
export function showSnackbar(
  message: string,
  options?: SnackbarOptions,
): void {
  const payload: SnackbarPayload = {
    message,
    duration: options?.duration ?? 3000,
    actionLabel: options?.actionLabel ?? "dismiss",
    onAction: options?.onAction,
  };

  listeners.forEach((listener) => {
    try {
      listener(payload);
    } catch (e) {
      console.error("error in snackbar listener:", e);
    }
  });
}

/**
 * Convenience helper to show the standard offline/connection error snackbar.
 */
export function showOfflineSnackbar(options?: Omit<SnackbarOptions, "actionLabel">): void {
  showSnackbar(OFFLINE_ERROR_MESSAGE, options);
}

/**
 * Subscribes to snackbar display events. Returns an unsubscribe function.
 */
export function subscribeSnackbar(listener: SnackbarListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

