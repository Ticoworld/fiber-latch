import { z } from "zod";

export const HealthResponseSchema = z.object({
  ok: z.literal(true),
  service: z.literal("fiber-latch"),
  phase: z.literal("phase-3"),
  network: z.literal("testnet"),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
