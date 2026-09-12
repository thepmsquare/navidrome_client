import type { Material3Scheme } from "@pchmn/expo-material3-theme";
import { MD3Theme, useTheme as usePaperTheme } from "react-native-paper";

export type AppTheme = Omit<MD3Theme, "colors"> & {
  colors: MD3Theme["colors"] & Material3Scheme;
};

export const useAppTheme = () => usePaperTheme<AppTheme>();
