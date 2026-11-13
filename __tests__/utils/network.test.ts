import * as snackbarModule from "@/services/snackbar";
import { handleNetworkOrOfflineError, isNetworkError } from "@/utils/network";

describe("network utils", () => {
  describe("isNetworkError", () => {
    it("returns false for null/undefined/empty", () => {
      expect(isNetworkError(null)).toBe(false);
      expect(isNetworkError(undefined)).toBe(false);
      expect(isNetworkError("")).toBe(false);
    });

    it("identifies string network errors", () => {
      expect(isNetworkError("Network request failed")).toBe(true);
      expect(isNetworkError("failed to fetch")).toBe(true);
      expect(isNetworkError("connection refused by peer")).toBe(true);
      expect(isNetworkError("timed out waiting for response")).toBe(true);
      expect(isNetworkError("device is offline")).toBe(true);
      expect(isNetworkError("could not connect to any of the specified server urls")).toBe(true);
      expect(isNetworkError("random syntax error")).toBe(false);
    });

    it("identifies Error objects with network messages", () => {
      expect(isNetworkError(new TypeError("Network request failed"))).toBe(true);
      expect(isNetworkError(new Error("Failed to fetch"))).toBe(true);
      expect(isNetworkError(new Error("connection timeout"))).toBe(true);
      expect(isNetworkError(new Error("unable to connect to server"))).toBe(true);
      expect(isNetworkError(new Error("validation error"))).toBe(false);
    });

    it("identifies AbortError and TimeoutError", () => {
      const abortErr = new Error("aborted");
      abortErr.name = "AbortError";
      expect(isNetworkError(abortErr)).toBe(true);

      const timeoutErr = new Error("timeout");
      timeoutErr.name = "TimeoutError";
      expect(isNetworkError(timeoutErr)).toBe(true);
    });

    it("identifies node/socket error codes", () => {
      expect(isNetworkError({ code: "ECONNREFUSED" })).toBe(true);
      expect(isNetworkError({ code: "ENOTFOUND" })).toBe(true);
      expect(isNetworkError({ code: "ETIMEDOUT" })).toBe(true);
      expect(isNetworkError({ code: "EHOSTUNREACH" })).toBe(true);
      expect(isNetworkError({ code: "ECONNRESET" })).toBe(true);
      expect(isNetworkError({ code: "ERR_INVALID_ARG" })).toBe(false);
    });

    it("identifies audio-playback / ExoPlayer error codes", () => {
      expect(isNetworkError({ errorCode: "ERROR_CODE_IO_NETWORK_CONNECTION_FAILED" })).toBe(true);
      expect(isNetworkError({ errorCode: "ERROR_CODE_IO_NETWORK_CONNECTION_TIMEOUT" })).toBe(true);
      expect(isNetworkError({ errorCode: "ERROR_CODE_IO_UNSPECIFIED" })).toBe(true);
      expect(isNetworkError({ errorCode: "ERROR_CODE_DECODER_INIT_FAILED" })).toBe(false);
    });
  });

  describe("handleNetworkOrOfflineError", () => {
    it("calls showOfflineSnackbar and returns true for network errors", () => {
      const spy = jest.spyOn(snackbarModule, "showOfflineSnackbar").mockImplementation(() => {});

      const result = handleNetworkOrOfflineError(new TypeError("Network request failed"));

      expect(result).toBe(true);
      expect(spy).toHaveBeenCalledTimes(1);

      spy.mockRestore();
    });

    it("returns false and does not trigger snackbar for non-network errors", () => {
      const spy = jest.spyOn(snackbarModule, "showOfflineSnackbar").mockImplementation(() => {});

      const result = handleNetworkOrOfflineError(new Error("unrelated business logic error"));

      expect(result).toBe(false);
      expect(spy).not.toHaveBeenCalled();

      spy.mockRestore();
    });
  });
});

