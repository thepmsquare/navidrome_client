import { z } from "zod";

export interface ServerCredentials {
  serverUrl: string;
  username: string;
  password: string;
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

export type SubsonicError = z.infer<typeof subsonicErrorSchema>;
export type PingResponse = z.infer<typeof pingResponseSchema>;
export type SubsonicPingResponseWrapper = z.infer<
  typeof subsonicPingResponseWrapperSchema
>;
