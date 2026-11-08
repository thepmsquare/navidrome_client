import * as SecureStore from "expo-secure-store";

import {
  DEFAULT_HOME_SECTIONS,
  getHomeSections,
  resolveHomeSections,
  saveHomeSections,
} from "@/services/homeSections";

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));

describe("homeSections service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getHomeSections", () => {
    it("returns default home sections when secure store has nothing", async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(null);

      const sections = await getHomeSections();
      expect(sections).toEqual(DEFAULT_HOME_SECTIONS);
    });

    it("parses stored home sections and appends any missing default sections", async () => {
      const stored = [
        { id: "recently_played", visible: true },
        { id: "most_played", visible: false },
      ];
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(
        JSON.stringify(stored),
      );

      const sections = await getHomeSections();
      expect(sections[0]).toEqual({ id: "recently_played", visible: true });
      expect(sections[1]).toEqual({ id: "most_played", visible: false });
      expect(sections.length).toBe(DEFAULT_HOME_SECTIONS.length);
      expect(sections.some((s) => s.id === "random_tracks")).toBe(true);
    });

    it("returns defaults when reading throws an error", async () => {
      const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      (SecureStore.getItemAsync as jest.Mock).mockRejectedValueOnce(
        new Error("secure store failure"),
      );

      const sections = await getHomeSections();
      expect(sections).toEqual(DEFAULT_HOME_SECTIONS);
      expect(errorSpy).toHaveBeenCalled();
      errorSpy.mockRestore();
    });
  });

  describe("saveHomeSections", () => {
    it("persists home sections to secure store", async () => {
      const sections = [{ id: "most_played", visible: true }];
      await saveHomeSections(sections);

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        "home_sections",
        JSON.stringify(sections),
      );
    });
  });

  describe("resolveHomeSections", () => {
    it("returns all default sections when configs is null or empty", () => {
      const resolved = resolveHomeSections(null);
      expect(resolved.length).toBe(6);
    });

    it("orders sections according to configs and filters hidden ones", () => {
      const configs = [
        { id: "recently_released", visible: true },
        { id: "most_played", visible: false },
        { id: "random_tracks", visible: true },
      ];

      const resolved = resolveHomeSections(configs);
      expect(resolved[0].id).toBe("recently_released");
      expect(resolved[1].id).toBe("random_tracks");
      expect(resolved.some((s) => s.id === "most_played")).toBe(false);
      // Unmentioned sections are appended with default visibility
      expect(resolved.some((s) => s.id === "random_albums")).toBe(true);
    });
  });
});

