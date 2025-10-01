// app/api/records/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Preflight/CORS centralizado
export { makeOptions as OPTIONS } from "../_lib/http";

import type { NextRequest } from "next/server";
import { sql } from "../_lib/db";
import { ok, err } from "../_lib/http";
import { requireUser } from "../_lib/auth";
import { z } from "zod";

// ——— Validación de body (crear registro) ———
const createSchema = z.object({
  meal_type: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  note: z.string().max(500).optional().nullable(),
  photoUrl: z.string().url(),
  thumbnailUrl: z.string().url().optional().nullable(),
  uploadId: z.string().uuid().optional().nullable(),
  clientTz: z.string().min(2),
  recordedAt: z.string().datetime().optional(), // ISO 8601 (con o sin zona)
});

// ——— Validación de query (listar) ———
const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  since: z.string().datetime().optional(),
});

type RecordRow = {
  id: string;
  meal_type: "breakfast" | "lunch" | "dinner" | "snack";
  note: string | null;
  photo_url: string;
  thumbnail_url: string | null;
  upload_id: string | null;
  client_tz: string;
  recorded_at: string;
  local_date: string;
  created_at: string;
};

// ——— GET /api/records ———
export async function GET(req: NextRequest) {
  try {
    const u = requireUser(req);

    const q = Object.fromEntries(req.nextUrl.searchParams.entries());
    const parsed = listQuerySchema.safeParse(q);
    if (!parsed.success) {
      return err("INVALID_QUERY", 400, { details: parsed.error.flatten() });
    }
    const { limit, since } = parsed.data;

    const rows: RecordRow[] = await sql/* sql */`
      SELECT id, meal_type, note, photo_url, thumbnail_url, upload_id,
             client_tz, recorded_at, local_date, created_at
      FROM records
      WHERE user_id = ${u.id}
        AND (${since ?? null}::timestamptz IS NULL OR recorded_at >= ${since ?? null})
      ORDER BY recorded_at DESC
      LIMIT ${limit}
    `;

    return ok({ items: rows });
  } catch (e) {
    if (e instanceof Error && /token|unauthori[sz]ed|bearer|jwt/i.test(e.message)) {
      return err("Unauthorized", 401);
    }
    if (e instanceof Error) {
      return err(e.message || "Failed to list records", 400);
    }
    return err("Failed to list records", 400);
  }
}

// ——— POST /api/records ———
export async function POST(req: NextRequest) {
  try {
    const u = requireUser(req);

    let bodyUnknown: unknown;
    try {
      bodyUnknown = await req.json();
    } catch {
      bodyUnknown = {};
    }
    const parsed = createSchema.safeParse(bodyUnknown);
    if (!parsed.success) {
      return err("INVALID_BODY", 400, { details: parsed.error.flatten() });
    }
    const body = parsed.data;

    const rows: RecordRow[] = await sql/* sql */`
      INSERT INTO records
        (user_id, meal_type, note, photo_url, thumbnail_url, upload_id, client_tz, recorded_at)
      VALUES
        (
          ${u.id},
          ${body.meal_type}::meal_type,
          ${body.note ?? null},
          ${body.photoUrl},
          ${body.thumbnailUrl ?? null},
          ${body.uploadId ?? null},
          ${body.clientTz},
          ${body.recordedAt ?? null}
        )
      RETURNING id, meal_type, note, photo_url, thumbnail_url, upload_id,
                client_tz, recorded_at, local_date, created_at
    `;

    const record = rows?.[0];
    if (!record) return err("FAILED_TO_CREATE_RECORD", 400);

    // OpenAPI lo marca como 200; si quieres, puedes devolver 201
    return ok({ record });
  } catch (e) {
    if (e instanceof Error && /token|unauthori[sz]ed|bearer|jwt/i.test(e.message)) {
      return err("Unauthorized", 401);
    }
    if (e instanceof Error) {
      return err(e.message || "Failed to create record", 400);
    }
    return err("Failed to create record", 400);
  }
}
