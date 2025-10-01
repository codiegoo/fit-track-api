// app/api/streaks/route.ts
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

export async function GET(req: NextRequest) {
  try {
    const u = requireUser(req); // Authorization: Bearer <access>

    const rows = (await sql/* sql */`
      SELECT
        compute_current_streak(${u.id}::uuid) AS current,
        compute_max_streak(${u.id}::uuid)     AS max
    `) as unknown as StreakRow[];

    const streak = rows?.[0];
    if (!streak) return err("FAILED_TO_GET_STREAKS", 400);

    return ok({ streak });
  } catch (e) {
    if (e instanceof Error && /token|unauthori[sz]ed|bearer|jwt/i.test(e.message)) {
      return err("Unauthorized", 401);
    }
    if (e instanceof Error) {
      return err(e.message || "Failed to get streaks", 400);
    }
    return err("Failed to get streaks", 400);
  }
}
