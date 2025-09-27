export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { sql } from '../../_lib/db';
import { ok, err } from '../../_lib/http';
export { OPTIONS } from '../../_lib/http';   // ← re-exporta OPTIONS (no declares una local)
import { requireUser } from '../../_lib/auth';

export async function GET(req: Request) {
  try {
    const u = requireUser(req);
    const [row] = await sql/*sql*/`
      SELECT id, email, name, avatar_url, tz, settings, last_login_at
      FROM users
      WHERE id = ${u.id}
      LIMIT 1
    `;
    if (!row) return err('User not found', 404);
    return ok({ user: row });
  } catch (e: any) {
    if (e?.message?.includes('token')) return err('Unauthorized', 401);
    return err('Failed to get user', 400);
  }
}
