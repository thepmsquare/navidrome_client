import { showOfflineSnackbar } from "@/services/snackbar";

/**
 * Checks if an error corresponds to a network or offline connection failure.
 */
export function isNetworkError(error: unknown): boolean {
  if (!error) return false;

  if (typeof error === "string") {
    const lower = error.toLowerCase();
    return (
      lower.includes("network") ||
      lower.includes("connection") ||
      lower.includes("timeout") ||
      lower.includes("timed out") ||
      lower.includes("failed to fetch") ||
      lower.includes("econnrefused") ||
      lower.includes("enotfound") ||
      lower.includes("ehostunreach") ||
      lower.includes("econnreset") ||
      lower.includes("offline") ||
      lower.includes("could not connect")
    );
  }

  if (typeof error === "object") {
    const err = error as {
      errorCode?: unknown;
      message?: unknown;
      code?: unknown;
      name?: unknown;
    };

    const message =
      typeof err.message === "string" ? err.message.toLowerCase() : "";
    const name = typeof err.name === "string" ? err.name.toLowerCase() : "";
    const code = typeof err.code === "string" ? err.code.toUpperCase() : "";
    const errorCode =
      typeof err.errorCode === "string" ? err.errorCode.toUpperCase() : "";

    // ExoPlayer / audio-playback error codes
    if (
      errorCode.includes("NETWORK") ||
      errorCode.includes("IO") ||
      errorCode.includes("CONNECTION") ||
      errorCode.includes("TIMEOUT")
    ) {
      return true;
    }

    // Node / socket error codes
    if (
      code === "ECONNREFUSED" ||
      code === "ENOTFOUND" ||
      code === "ETIMEDOUT" ||
      code === "EHOSTUNREACH" ||
      code === "ECONNRESET"
    ) {
      return true;
    }

    // Common standard JS / React Native fetch errors
    if (
      message.includes("network request failed") ||
      message.includes("failed to fetch") ||
      message.includes("network error") ||
      message.includes("connection refused") ||
      message.includes("connection timeout") ||
      message.includes("timed out") ||
      message.includes("timeout") ||
      message.includes("offline") ||
      message.includes("could not connect") ||
      message.includes("unable to connect") ||
      name === "aborterror" ||
      name === "timeouterror"
    ) {
      return true;
    }
  }

  return false;
}

/**
 * If the error is network/offline related, dispatches the offline snackbar and returns true.
 * Otherwise returns false.
 */
export function handleNetworkOrOfflineError(error: unknown): boolean {
  if (isNetworkError(error)) {
    showOfflineSnackbar();
    return true;
  }
  return false;
}

