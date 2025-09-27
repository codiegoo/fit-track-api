export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { sql } from '../_lib/db';
import { ok, err } from '../_lib/http';
export { OPTIONS } from '../_lib/http';        // ← re-exporta el handler CORS
import { requireUser } from '../_lib/auth';
import { z } from 'zod';

const createSchema = z.object({
  meal_type: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  note: z.string().max(500).optional().nullable(),
  photoUrl: z.string().url(),
  thumbnailUrl: z.string().url().optional().nullable(),
  uploadId: z.string().uuid().optional().nullable(),
  clientTz: z.string().min(2),
  recordedAt: z.string().datetime().optional(), // ISO 8601 con zona (p.ej. 2025-01-01T12:00:00Z)
});

export async function GET(req: Request) {
  try {
    const u = requireUser(req);

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const since = searchParams.get('since'); // ISO string o null

    const rows = await sql/*sql*/`
      SELECT id, meal_type, note, photo_url, thumbnail_url, upload_id,
             client_tz, recorded_at, local_date, created_at
      FROM records
      WHERE user_id = ${u.id}
        AND (${since || null}::timestamptz IS NULL OR recorded_at >= ${since || null})
      ORDER BY recorded_at DESC
      LIMIT ${limit}
    `;
    return ok({ items: rows });
  } catch (e: any) {
    if (e?.message?.includes('token')) return err('Unauthorized', 401);
    return err('Failed to list records', 400);
  }
}

export async function POST(req: Request) {
  try {
    const u = requireUser(req);
    const body = createSchema.parse(await req.json());

    const [row] = await sql/*sql*/`
      INSERT INTO records
        (user_id, meal_type, note, photo_url, thumbnail_url, upload_id, client_tz, recorded_at)
      VALUES
        (${u.id}, ${body.meal_type}::meal_type, ${body.note ?? null},
         ${body.photoUrl}, ${body.thumbnailUrl ?? null}, ${body.uploadId ?? null},
         ${body.clientTz}, ${body.recordedAt ?? null})
      RETURNING id, meal_type, note, photo_url, thumbnail_url, upload_id,
                client_tz, recorded_at, local_date, created_at
    `;
    return ok({ record: row });
  } catch (e: any) {
    if (e?.issues) return err(e.issues[0].message, 400);
    if (e?.message?.includes('token')) return err('Unauthorized', 401);
    return err('Failed to create record', 400);
  }
}
