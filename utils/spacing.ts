/**
 * spacing tokens
 *
 * single source of truth for all spacing values in the app.
 * these values map to the m3 spacing guidance for compact screens.
 *
 * usage:
 *   import { spacing } from "@/utils/spacing";
 *   gap: spacing.md      // 16
 *   padding: spacing.md  // 16
 */
export const spacing = {
  /** 4dp — tight internal gaps, e.g. icon-to-label */
  xs: 4,
  /** 8dp — between related elements within a component, section title → card */
  sm: 8,
  /** 16dp — standard card padding, between form fields, horizontal page margin */
  md: 16,
  /** 24dp — between sections on a page */
  lg: 24,
  /** 32dp — major section or hero spacing */
  xl: 32,
  /** 48dp — page-level breathing room */
  xxl: 48,
} as const;
