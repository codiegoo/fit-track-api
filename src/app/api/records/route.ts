export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { sql } from '../_lib/db';
import { ok, err } from '../_lib/http';
export { OPTIONS } from '../_lib/http';        // CORS/preflight
import { requireUser } from '../_lib/auth';
import { z, ZodError } from 'zod';

const createSchema = z.object({
  meal_type: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  note: z.string().max(500).optional().nullable(),
  photoUrl: z.string().url(),
  thumbnailUrl: z.string().url().optional().nullable(),
  uploadId: z.string().uuid().optional().nullable(),
  clientTz: z.string().min(2),
  recordedAt: z.string().datetime().optional(), // ISO 8601 con zona
});

type RecordRow = {
  id: string;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  note: string | null;
  photo_url: string;
  thumbnail_url: string | null;
  upload_id: string | null;
  client_tz: string;
  recorded_at: string;   // timestamptz -> ISO
  local_date: string;    // date -> YYYY-MM-DD
  created_at: string;    // timestamptz -> ISO
};

export async function GET(req: Request) {
  try {
    const u = requireUser(req);

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);

    const sinceRaw = searchParams.get('since');
    if (sinceRaw && Number.isNaN(Date.parse(sinceRaw))) {
      return err('Invalid "since" (use ISO 8601, e.g. 2025-01-01T12:00:00Z)', 400);
    }
    const since = sinceRaw ?? null;

    const rows = await sql/*sql*/`
      SELECT id, meal_type, note, photo_url, thumbnail_url, upload_id,
             client_tz, recorded_at, local_date, created_at
      FROM records
      WHERE user_id = ${u.id}
        AND (${since}::timestamptz IS NULL OR recorded_at >= ${since})
      ORDER BY recorded_at DESC
      LIMIT ${limit}
    ` as unknown as RecordRow[];

    return ok({ items: rows });
  } catch (e: unknown) {
    if (e instanceof Error && /token/i.test(e.message)) return err('Unauthorized', 401);
    if (e instanceof Error) return err(e.message || 'Failed to list records', 400);
    return err('Failed to list records', 400);
  }
}

export async function POST(req: Request) {
  try {
    const u = requireUser(req);
    const body = createSchema.parse(await req.json());

    const rows = await sql/*sql*/`
      INSERT INTO records
        (user_id, meal_type, note, photo_url, thumbnail_url, upload_id, client_tz, recorded_at)
      VALUES
        (${u.id}, ${body.meal_type}::meal_type, ${body.note ?? null},
         ${body.photoUrl}, ${body.thumbnailUrl ?? null}, ${body.uploadId ?? null},
         ${body.clientTz}, ${body.recordedAt ?? null})
      RETURNING id, meal_type, note, photo_url, thumbnail_url, upload_id,
                client_tz, recorded_at, local_date, created_at
    ` as unknown as RecordRow[];

    const row = rows[0];
    return ok({ record: row });
  } catch (e: unknown) {
    if (e instanceof ZodError) {
      return err(e.issues[0]?.message ?? 'Invalid body', 400);
    }
    if (e instanceof Error && /token/i.test(e.message)) return err('Unauthorized', 401);
    if (e instanceof Error) return err(e.message || 'Failed to create record', 400);
    return err('Failed to create record', 400);
  }
}
