import { z } from "zod";

export interface ServerCredentials {
  serverUrl: string;
  username: string;
  password: string;
}

export interface Search3Params {
  query: string;
  artistCount?: number;
  artistOffset?: number;
  albumCount?: number;
  albumOffset?: number;
  songCount?: number;
  songOffset?: number;
  musicFolderId?: string;
}

export interface Search3Counts {
  artistCount: number;
  albumCount: number;
  songCount: number;
}

export const subsonicErrorSchema = z.object({
  code: z.number(),
  message: z.string(),
});

export const pingResponseSchema = z.object({
  status: z.string(),
  version: z.string(),
  type: z.string().optional(),
  serverVersion: z.string().optional(),
  openSubsonic: z.boolean().optional(),
  error: subsonicErrorSchema.optional(),
});

export const subsonicPingResponseWrapperSchema = z.object({
  "subsonic-response": pingResponseSchema,
});

export const artistID3Schema = z.object({
  id: z.string(),
  name: z.string(),
  coverArt: z.string().optional().nullable(),
  artistImageUrl: z.string().optional().nullable(),
  albumCount: z.number().optional().nullable(),
  starred: z.string().optional().nullable(),
  userRating: z.number().optional().nullable(),
  musicBrainzId: z.string().optional().nullable(),
  sortName: z.string().optional().nullable(),
  roles: z.array(z.string()).optional().nullable(),
});

export const itemDateSchema = z.object({
  year: z.number().optional().nullable(),
  month: z.number().optional().nullable(),
  day: z.number().optional().nullable(),
});

export const nameItemSchema = z.object({
  name: z.string(),
});

export const artistRefSchema = z.object({
  id: z.string(),
  name: z.string(),
});

export const albumID3Schema = z.object({
  id: z.string(),
  name: z.string(),
  title: z.string().optional().nullable(),
  artist: z.string().optional().nullable(),
  artistId: z.string().optional().nullable(),
  coverArt: z.string().optional().nullable(),
  songCount: z.number().optional().nullable(),
  duration: z.number().optional().nullable(),
  playCount: z.number().optional().nullable(),
  created: z.string().optional().nullable(),
  played: z.string().optional().nullable(),
  starred: z.string().optional().nullable(),
  year: z.number().optional().nullable(),
  genre: z.string().optional().nullable(),
  genres: z
    .array(z.union([z.string(), nameItemSchema]))
    .optional()
    .nullable(),
  userRating: z.number().optional().nullable(),
  musicBrainzId: z.string().optional().nullable(),
  isCompilation: z.boolean().optional().nullable(),
  sortName: z.string().optional().nullable(),
  originalReleaseDate: itemDateSchema.optional().nullable(),
  releaseDate: itemDateSchema.optional().nullable(),
  releaseTypes: z.array(z.string()).optional().nullable(),
  recordLabels: z.array(nameItemSchema).optional().nullable(),
  artists: z.array(artistRefSchema).optional().nullable(),
  displayArtist: z.string().optional().nullable(),
  explicitStatus: z.string().optional().nullable(),
  version: z.string().optional().nullable(),
});

export const contributorSchema = z.object({
  role: z.string().optional().nullable(),
  subRole: z.string().optional().nullable(),
  artist: artistRefSchema.optional().nullable(),
});

export const childSchema = z.object({
  id: z.string(),
  parent: z.string().optional().nullable(),
  isDir: z.boolean().optional().nullable(),
  title: z.string(),
  album: z.string().optional().nullable(),
  artist: z.string().optional().nullable(),
  track: z.number().optional().nullable(),
  year: z.number().optional().nullable(),
  genre: z.string().optional().nullable(),
  genres: z
    .array(z.union([z.string(), nameItemSchema]))
    .optional()
    .nullable(),
  coverArt: z.string().optional().nullable(),
  size: z.number().optional().nullable(),
  contentType: z.string().optional().nullable(),
  suffix: z.string().optional().nullable(),
  duration: z.number().optional().nullable(),
  bitRate: z.number().optional().nullable(),
  path: z.string().optional().nullable(),
  isVideo: z.boolean().optional().nullable(),
  userRating: z.number().optional().nullable(),
  averageRating: z.number().optional().nullable(),
  playCount: z.number().optional().nullable(),
  discNumber: z.number().optional().nullable(),
  created: z.string().optional().nullable(),
  played: z.string().optional().nullable(),
  starred: z.string().optional().nullable(),
  albumId: z.string().optional().nullable(),
  artistId: z.string().optional().nullable(),
  type: z.string().optional().nullable(),
  bpm: z.number().optional().nullable(),
  comment: z.string().optional().nullable(),
  sortName: z.string().optional().nullable(),
  mediaType: z.string().optional().nullable(),
  musicBrainzId: z.string().optional().nullable(),
  isrc: z.array(z.string()).optional().nullable(),
  channelCount: z.number().optional().nullable(),
  samplingRate: z.number().optional().nullable(),
  bitDepth: z.number().optional().nullable(),
  artists: z.array(artistRefSchema).optional().nullable(),
  displayArtist: z.string().optional().nullable(),
  albumArtists: z.array(artistRefSchema).optional().nullable(),
  displayAlbumArtist: z.string().optional().nullable(),
  contributors: z.array(contributorSchema).optional().nullable(),
  displayComposer: z.string().optional().nullable(),
  explicitStatus: z.string().optional().nullable(),
});

export const searchResult3Schema = z.object({
  artist: z.array(artistID3Schema).optional(),
  album: z.array(albumID3Schema).optional(),
  song: z.array(childSchema).optional(),
});

export const search3ResponseSchema = z.object({
  status: z.string(),
  version: z.string(),
  type: z.string().optional(),
  serverVersion: z.string().optional(),
  openSubsonic: z.boolean().optional(),
  error: subsonicErrorSchema.optional(),
  searchResult3: searchResult3Schema.optional(),
});

export const subsonicSearch3ResponseWrapperSchema = z.object({
  "subsonic-response": search3ResponseSchema,
});

export type SubsonicError = z.infer<typeof subsonicErrorSchema>;
export type PingResponse = z.infer<typeof pingResponseSchema>;
export type SubsonicPingResponseWrapper = z.infer<
  typeof subsonicPingResponseWrapperSchema
>;
export type ArtistID3 = z.infer<typeof artistID3Schema>;
export type AlbumID3 = z.infer<typeof albumID3Schema>;
export type Child = z.infer<typeof childSchema>;
export type SearchResult3 = z.infer<typeof searchResult3Schema>;
export type Search3Response = z.infer<typeof search3ResponseSchema>;
export type SubsonicSearch3ResponseWrapper = z.infer<
  typeof subsonicSearch3ResponseWrapperSchema
>;
