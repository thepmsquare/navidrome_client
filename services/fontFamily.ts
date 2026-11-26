import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import {
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
} from "@expo-google-fonts/outfit";
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from "@expo-google-fonts/plus-jakarta-sans";
import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from "@expo-google-fonts/poppins";
import {
  Roboto_400Regular,
  Roboto_500Medium,
  Roboto_600SemiBold,
  Roboto_700Bold,
} from "@expo-google-fonts/roboto";
import { MD3LightTheme, configureFonts } from "react-native-paper";

import { getFontFamilySetting, setFontFamilySetting } from "@/services/db";
import { FontFamilyKey } from "@/types";

export interface FontFamilyOption {
  key: FontFamilyKey;
  label: string;
  regular?: string;
  medium?: string;
  semibold?: string;
  bold?: string;
}

export const FONT_FAMILY_OPTIONS: FontFamilyOption[] = [
  { key: "system", label: "system default" },
  {
    key: "inter",
    label: "inter",
    regular: "Inter_400Regular",
    medium: "Inter_500Medium",
    semibold: "Inter_600SemiBold",
    bold: "Inter_700Bold",
  },
  {
    key: "roboto",
    label: "roboto",
    regular: "Roboto_400Regular",
    medium: "Roboto_500Medium",
    semibold: "Roboto_600SemiBold",
    bold: "Roboto_700Bold",
  },
  {
    key: "poppins",
    label: "poppins",
    regular: "Poppins_400Regular",
    medium: "Poppins_500Medium",
    semibold: "Poppins_600SemiBold",
    bold: "Poppins_700Bold",
  },
  {
    key: "outfit",
    label: "outfit",
    regular: "Outfit_400Regular",
    medium: "Outfit_500Medium",
    semibold: "Outfit_600SemiBold",
    bold: "Outfit_700Bold",
  },
  {
    key: "plus_jakarta_sans",
    label: "plus jakarta sans",
    regular: "PlusJakartaSans_400Regular",
    medium: "PlusJakartaSans_500Medium",
    semibold: "PlusJakartaSans_600SemiBold",
    bold: "PlusJakartaSans_700Bold",
  },
];

export const FONT_ASSETS = {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Roboto_400Regular,
  Roboto_500Medium,
  Roboto_600SemiBold,
  Roboto_700Bold,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
};

type FontListener = (font: FontFamilyKey) => void;
const listeners = new Set<FontListener>();

export function getFontFamily(): FontFamilyKey {
  try {
    return getFontFamilySetting();
  } catch {
    return "system";
  }
}

export function setFontFamily(font: FontFamilyKey): void {
  setFontFamilySetting(font);
  listeners.forEach((cb) => cb(font));
}

export function subscribeFontFamily(listener: FontListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getFontOption(key: FontFamilyKey): FontFamilyOption {
  return (
    FONT_FAMILY_OPTIONS.find((opt) => opt.key === key) ?? FONT_FAMILY_OPTIONS[0]
  );
}

export function buildPaperFonts(
  fontKey: FontFamilyKey,
  fontsLoaded: boolean = true,
) {
  const option = getFontOption(fontKey);
  if (!fontsLoaded || option.key === "system" || !option.regular) {
    return MD3LightTheme.fonts;
  }

  const base = MD3LightTheme.fonts;
  const regular = option.regular;
  const medium = option.medium ?? option.regular;

  return configureFonts({
    config: {
      displayLarge: {
        ...base.displayLarge,
        fontFamily: regular,
        fontWeight: undefined,
      },
      displayMedium: {
        ...base.displayMedium,
        fontFamily: regular,
        fontWeight: undefined,
      },
      displaySmall: {
        ...base.displaySmall,
        fontFamily: regular,
        fontWeight: undefined,
      },
      headlineLarge: {
        ...base.headlineLarge,
        fontFamily: regular,
        fontWeight: undefined,
      },
      headlineMedium: {
        ...base.headlineMedium,
        fontFamily: regular,
        fontWeight: undefined,
      },
      headlineSmall: {
        ...base.headlineSmall,
        fontFamily: regular,
        fontWeight: undefined,
      },
      titleLarge: {
        ...base.titleLarge,
        fontFamily: regular,
        fontWeight: undefined,
      },
      titleMedium: {
        ...base.titleMedium,
        fontFamily: medium,
        fontWeight: undefined,
      },
      titleSmall: {
        ...base.titleSmall,
        fontFamily: medium,
        fontWeight: undefined,
      },
      labelLarge: {
        ...base.labelLarge,
        fontFamily: medium,
        fontWeight: undefined,
      },
      labelMedium: {
        ...base.labelMedium,
        fontFamily: medium,
        fontWeight: undefined,
      },
      labelSmall: {
        ...base.labelSmall,
        fontFamily: medium,
        fontWeight: undefined,
      },
      bodyLarge: {
        ...base.bodyLarge,
        fontFamily: regular,
        fontWeight: undefined,
      },
      bodyMedium: {
        ...base.bodyMedium,
        fontFamily: regular,
        fontWeight: undefined,
      },
      bodySmall: {
        ...base.bodySmall,
        fontFamily: regular,
        fontWeight: undefined,
      },
    },
  });
}
