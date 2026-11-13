import {
  OFFLINE_ERROR_MESSAGE,
  showOfflineSnackbar,
  showSnackbar,
  subscribeSnackbar,
} from "@/services/snackbar";

describe("snackbar service", () => {
  it("subscribes and notifies listener when showSnackbar is called", () => {
    const listener = jest.fn();
    const unsubscribe = subscribeSnackbar(listener);

    showSnackbar("test message", { duration: 4000, actionLabel: "ok" });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({
      message: "test message",
      duration: 4000,
      actionLabel: "ok",
      onAction: undefined,
    });

    unsubscribe();
  });

  it("uses default duration and actionLabel", () => {
    const listener = jest.fn();
    const unsubscribe = subscribeSnackbar(listener);

    showSnackbar("simple message");

    expect(listener).toHaveBeenCalledWith({
      message: "simple message",
      duration: 3000,
      actionLabel: "dismiss",
      onAction: undefined,
    });

    unsubscribe();
  });

  it("handles onAction callback", () => {
    const listener = jest.fn();
    const onAction = jest.fn();
    const unsubscribe = subscribeSnackbar(listener);

    showSnackbar("action test", { onAction });

    expect(listener).toHaveBeenCalledWith({
      message: "action test",
      duration: 3000,
      actionLabel: "dismiss",
      onAction,
    });

    unsubscribe();
  });

  it("showOfflineSnackbar triggers standard offline error message", () => {
    const listener = jest.fn();
    const unsubscribe = subscribeSnackbar(listener);

    showOfflineSnackbar();

    expect(listener).toHaveBeenCalledWith({
      message: OFFLINE_ERROR_MESSAGE,
      duration: 3000,
      actionLabel: "dismiss",
      onAction: undefined,
    });

    unsubscribe();
  });

  it("unsubscribing stops receiving events", () => {
    const listener = jest.fn();
    const unsubscribe = subscribeSnackbar(listener);

    unsubscribe();
    showSnackbar("another message");

    expect(listener).not.toHaveBeenCalled();
  });

  it("catches listener errors gracefully", () => {
    const errorListener = jest.fn().mockImplementation(() => {
      throw new Error("listener error");
    });
    const goodListener = jest.fn();

    const unsub1 = subscribeSnackbar(errorListener);
    const unsub2 = subscribeSnackbar(goodListener);

    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    expect(() => showSnackbar("crash test")).not.toThrow();
    expect(goodListener).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
    unsub1();
    unsub2();
  });
});

