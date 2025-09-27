export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { sql } from '../_lib/db';
import { ok, err } from '../_lib/http';
export { OPTIONS } from '../_lib/http';
import { requireUser } from '../_lib/auth';

type StreakRow = {
  current: number;
  max: number;
};

export async function GET(req: Request) {
  try {
    const u = requireUser(req);

    const rows = await sql/*sql*/`
      SELECT compute_current_streak(${u.id}::uuid) AS current,
             compute_max_streak(${u.id}::uuid)     AS max
    ` as unknown as StreakRow[];

    const row = rows[0];
    return ok({ streak: row });
  } catch (e: unknown) {
    if (e instanceof Error && /token/i.test(e.message)) {
      return err('Unauthorized', 401);
    }
    if (e instanceof Error) {
      return err(e.message || 'Failed to get streaks', 400);
    }
    return err('Failed to get streaks', 400);
  }
}
