// app/api/users/me/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export { makeOptions as OPTIONS } from "../../_lib/http";

import type { NextRequest } from "next/server";
import { sql } from "../../_lib/db";
import { ok, err } from "../../_lib/http";
import { requireUser } from "../../_lib/auth";

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  tz: string;
  settings: unknown;            // JSONB
  last_login_at: string | null; // timestamptz ISO o null
};

export async function GET(req: NextRequest) {
  try {
    const u = requireUser(req); // Authorization: Bearer <access>

    const rows = (await sql/* sql */`
      SELECT id, email, name, avatar_url, tz, settings, last_login_at
      FROM users
      WHERE id = ${u.id}
      LIMIT 1
    `) as unknown as UserRow[];

    const user = rows?.[0];
    if (!user) return err("User not found", 404);

    return ok({ user });
  } catch (e) {
    if (e instanceof Error && /token|unauthori[sz]ed|bearer|jwt/i.test(e.message)) {
      return err("Unauthorized", 401);
    }
    if (e instanceof Error) {
      return err(e.message || "Failed to get user", 400);
    }
    return err("Failed to get user", 400);
  }
}
