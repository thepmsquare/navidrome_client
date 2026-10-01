import { z } from "zod";

export const lyricsLineSchema = z.object({
  start: z.number().optional().nullable(),
  value: z.string().default(""),
});

export type LyricsLine = z.infer<typeof lyricsLineSchema>;

export const structuredLyricsSchema = z.object({
  lang: z.string().optional().nullable(),
  synced: z.boolean().optional().nullable(),
  offset: z.number().optional().nullable(),
  line: z
    .union([
      z.array(lyricsLineSchema),
      lyricsLineSchema.transform((val) => [val]),
    ])
    .optional()
    .nullable(),
});

export type StructuredLyrics = z.infer<typeof structuredLyricsSchema>;

export const lyricsListSchema = z.object({
  structuredLyrics: z
    .union([
      z.array(structuredLyricsSchema),
      structuredLyricsSchema.transform((val) => [val]),
    ])
    .optional()
    .nullable(),
});

export type LyricsList = z.infer<typeof lyricsListSchema>;

export const getLyricsBySongIdResponseSchema = z.object({
  status: z.string(),
  version: z.string().optional(),
  type: z.string().optional(),
  serverVersion: z.string().optional(),
  openSubsonic: z.boolean().optional(),
  error: z
    .object({
      code: z.number(),
      message: z.string(),
    })
    .optional(),
  lyricsList: lyricsListSchema.optional().nullable(),
});

export const subsonicGetLyricsBySongIdResponseWrapperSchema = z.object({
  "subsonic-response": getLyricsBySongIdResponseSchema,
});

export interface NormalizedLyricsLine {
  startMs?: number;
  text: string;
}

export interface NormalizedLyrics {
  synced: boolean;
  lang?: string;
  offsetMs?: number;
  lines: NormalizedLyricsLine[];
}

export type LyricsSource = "server" | "lrclib";

export type LyricsCacheStatus = "found" | "none" | "instrumental";

export interface LyricsCacheRow {
  songId: string;
  source: LyricsSource;
  status: LyricsCacheStatus;
  synced: number;
  lang: string | null;
  offsetMs: number | null;
  linesJson: string | null;
  fetchedAt: number;
}

export type LyricsMode = "file_only" | "file_first" | "online_first";

export interface LyricsTrackMetadata {
  title: string;
  artist?: string | null;
  album?: string | null;
  duration?: number | null; // duration in seconds
}

export type OnlineLyricsProviderResult =
  | { kind: "found"; lyrics: NormalizedLyrics }
  | { kind: "instrumental" }
  | { kind: "none" }
  | { kind: "unavailable" };
