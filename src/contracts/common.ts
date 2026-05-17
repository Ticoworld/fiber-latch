import { z } from "zod";
import { RESOURCE_TYPES, SUBJECT_TYPES } from "../domain/access-state";

export const ResourceSchema = z.object({
  key: z.string().min(1),
  type: z.enum(RESOURCE_TYPES),
});

export const SubjectSchema = z.object({
  type: z.enum(SUBJECT_TYPES),
  id: z.string().min(1),
});

export type Resource = z.infer<typeof ResourceSchema>;
export type Subject = z.infer<typeof SubjectSchema>;
