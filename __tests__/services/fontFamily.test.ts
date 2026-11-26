jest.mock("@/services/db", () => ({
  getFontFamilySetting: jest.fn(() => "system"),
  setFontFamilySetting: jest.fn(),
}));

import { MD3LightTheme } from "react-native-paper";

import * as db from "@/services/db";
import {
  buildPaperFonts,
  FONT_FAMILY_OPTIONS,
  getFontFamily,
  getFontOption,
  setFontFamily,
  subscribeFontFamily,
} from "@/services/fontFamily";

describe("fontFamily service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("reads font family from db with fallback to system", () => {
    (db.getFontFamilySetting as jest.Mock).mockReturnValue("inter");
    expect(getFontFamily()).toBe("inter");

    (db.getFontFamilySetting as jest.Mock).mockImplementation(() => {
      throw new Error("db not ready");
    });
    expect(getFontFamily()).toBe("system");
  });

  it("persists font family and notifies subscribers", () => {
    const listener = jest.fn();
    const unsub = subscribeFontFamily(listener);

    setFontFamily("poppins");
    expect(db.setFontFamilySetting).toHaveBeenCalledWith("poppins");
    expect(listener).toHaveBeenCalledWith("poppins");

    unsub();
    setFontFamily("outfit");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("returns default system fonts when system is selected or fonts are not loaded", () => {
    expect(buildPaperFonts("system", true)).toBe(MD3LightTheme.fonts);
    expect(buildPaperFonts("inter", false)).toBe(MD3LightTheme.fonts);
  });

  it("maps Paper MD3 typescale variants to custom font weights when loaded", () => {
    const fonts = buildPaperFonts("plus_jakarta_sans", true);
    expect(fonts.bodyLarge.fontFamily).toBe("PlusJakartaSans_400Regular");
    expect(fonts.titleMedium.fontFamily).toBe("PlusJakartaSans_500Medium");
    expect(fonts.labelLarge.fontFamily).toBe("PlusJakartaSans_500Medium");
    expect(fonts.bodyLarge.fontWeight).toBeUndefined();
  });

  it("exposes all expected font options", () => {
    expect(FONT_FAMILY_OPTIONS.map((o) => o.key)).toEqual([
      "system",
      "inter",
      "roboto",
      "poppins",
      "outfit",
      "plus_jakarta_sans",
    ]);
    expect(getFontOption("roboto").label).toBe("roboto");
  });
});
