import { z } from "zod";

export const JwkSchema = z.record(z.string(), z.unknown());

export const JwksResponseSchema = z.object({
  keys: z.array(JwkSchema),
});

export type JwksResponse = z.infer<typeof JwksResponseSchema>;
