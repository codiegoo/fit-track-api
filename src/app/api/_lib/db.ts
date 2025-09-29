import { neon } from "@neondatabase/serverless";
import { ENV } from "./env";

export const sql = neon(ENV.DATABASE_URL);

export function isUniqueViolation(e: unknown): e is { code: "23505" } {
  if (typeof e !== "object" || e === null) return false;
  const code = (e as { code?: unknown }).code;
  return typeof code === "string" && code === "23505";
}
