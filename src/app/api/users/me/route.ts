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
  settings: Record<string, unknown>;
  last_login_at: string | null;
};

export async function GET(req: NextRequest) {
  try {
    const u = requireUser(req);

    const rows = (await sql/* sql */`
      SELECT id, email, name, avatar_url, tz, settings, last_login_at
      FROM users
      WHERE id = ${u.id}
      LIMIT 1
    `) as UserRow[];

    const user = rows[0];
    if (!user) return err("USER_NOT_FOUND", 404);

    return ok({ user }); // { ok:true, user }
  } catch (e) {
    if (e instanceof Error && /token|unauthori[sz]ed|bearer|jwt/i.test(e.message)) {
      return err("UNAUTHORIZED", 401);
    }
    return err(e instanceof Error ? e.message : "FAILED_TO_GET_USER", 400);
  }
}
