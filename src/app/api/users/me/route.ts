export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { sql } from '../../_lib/db';
import { ok, err } from '../../_lib/http';
export { OPTIONS } from '../../_lib/http';
import { requireUser } from '../../_lib/auth';

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  tz: string;
  settings: unknown;          // JSONB
  last_login_at: string | null; // timestamptz -> ISO o null
};

export async function GET(req: Request) {
  try {
    const u = requireUser(req);

    const rows = await sql/*sql*/`
      SELECT id, email, name, avatar_url, tz, settings, last_login_at
      FROM users
      WHERE id = ${u.id}
      LIMIT 1
    ` as unknown as UserRow[];

    const row = rows[0];
    if (!row) return err('User not found', 404);
    return ok({ user: row });
  } catch (e: unknown) {
    if (e instanceof Error && /token/i.test(e.message)) return err('Unauthorized', 401);
    if (e instanceof Error) return err(e.message || 'Failed to get user', 400);
    return err('Failed to get user', 400);
  }
}
