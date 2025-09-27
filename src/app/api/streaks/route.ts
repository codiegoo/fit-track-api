export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { sql } from '../_lib/db';
import { ok, err } from '../_lib/http';
export { OPTIONS } from '../_lib/http';     // ← re-exporta el handler CORS/preflight
import { requireUser } from '../_lib/auth';

export async function GET(req: Request) {
  try {
    const u = requireUser(req);
    const [row] = await sql/*sql*/`
      SELECT compute_current_streak(${u.id}::uuid) AS current,
             compute_max_streak(${u.id}::uuid)     AS max
    `;
    return ok({ streak: row });
  } catch (e: any) {
    if (e?.message?.includes('token')) return err('Unauthorized', 401);
    return err('Failed to get streaks', 400);
  }
}
