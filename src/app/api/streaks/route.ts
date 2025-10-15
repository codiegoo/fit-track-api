export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export { makeOptions as OPTIONS } from "../_lib/http";

import type { NextRequest } from "next/server";
import { sql } from "../_lib/db";
import { ok, err } from "../_lib/http";
import { requireUser } from "../_lib/auth";

type StreakRow = {
  current: number;
  max: number;
};

// —— GET /api/streaks ——
// No usa CORS. Web lo consume vía BFF (mismo dominio).
// Android lo llama directo con Authorization: Bearer <token>.
export async function GET(req: NextRequest) {
  try {
    const user = requireUser(req);

    const rows = (await sql/*sql*/`
      SELECT
        compute_current_streak(${user.id}::uuid) AS current,
        compute_max_streak(${user.id}::uuid)     AS max
    `) as StreakRow[];

    const streak = rows?.[0];
    if (!streak) return err("FAILED_TO_GET_STREAKS", 400);

    return ok({ streak });
  } catch (e) {
    if (e instanceof Error && /token|unauthori[sz]ed|bearer|jwt/i.test(e.message)) {
      return err("UNAUTHORIZED", 401);
    }
    return err(e instanceof Error ? e.message : "FAILED_TO_GET_STREAKS", 400);
  }
}
