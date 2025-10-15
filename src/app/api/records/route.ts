// src/app/api/records/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export { makeOptions as OPTIONS } from "../_lib/http";

import type { NextRequest } from "next/server";
import { sql } from "../_lib/db";
import { ok, err } from "../_lib/http";
import { requireUser } from "../_lib/auth";
import { z } from "zod";

// ===== Validaciones =====
const MealType = z.enum(["breakfast", "lunch", "dinner", "snack"]);

const createJson = z.object({
  meal_type: MealType,
  note: z.string().max(500).optional().nullable(),
  clientTz: z.string().min(2),
  recordedAt: z.string().datetime().optional(),
  photo: z.string().optional().nullable(),     // base64
  photoName: z.string().optional().nullable(),
});

const listQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  since: z.string().datetime().optional(),
});

type RecordRow = {
  id: string;
  meal_type: z.infer<typeof MealType>;
  note: string | null;
  photo_data: string | null;
  photo_name: string | null;
  client_tz: string;
  recorded_at: string;
  local_date: string;
  created_at: string;
};

// ===== GET /api/records =====
export async function GET(req: NextRequest) {
  try {
    const user = requireUser(req);
    const q = Object.fromEntries(req.nextUrl.searchParams.entries());
    const parsed = listQuery.safeParse(q);
    if (!parsed.success) return err("INVALID_QUERY", 400, { details: parsed.error.toString() });

    const { limit, since } = parsed.data;

    const rows = (await sql/* sql */`
      SELECT id, meal_type, note, photo_data, photo_name,
             client_tz, recorded_at, local_date, created_at
      FROM records
      WHERE user_id = ${user.id}
        AND (${since ?? null}::timestamptz IS NULL OR recorded_at >= ${since ?? null})
      ORDER BY recorded_at DESC
      LIMIT ${limit}
    `) as RecordRow[];

    return ok({ items: rows });
  } catch (e) {
    if (e instanceof Error && /token|unauthori[sz]ed|bearer|jwt/i.test(e.message)) return err("UNAUTHORIZED", 401);
    return err(e instanceof Error ? e.message : "FAILED_TO_LIST_RECORDS", 400);
  }
}

// ===== POST /api/records =====
// Soporta JSON (base64) y multipart/form-data (archivo desde web)
export async function POST(req: NextRequest) {
  try {
    const user = requireUser(req);
    const ct = req.headers.get("content-type") ?? "";

    // comunes
    let meal_type: z.infer<typeof MealType>;
    let note: string | null = null;
    let clientTz = "UTC";
    let recordedAt: string | null = null;
    let photo_data: string | null = null;
    let photo_name: string | null = null;

    if (ct.includes("application/json")) {
      const body = await req.json().catch(() => ({}));
      const parsed = createJson.safeParse(body);
      if (!parsed.success) return err("INVALID_BODY", 400, { details: parsed.error.toString() });

      meal_type  = parsed.data.meal_type;
      note       = parsed.data.note ?? null;
      clientTz   = parsed.data.clientTz;
      recordedAt = parsed.data.recordedAt ?? null;
      photo_data = parsed.data.photo ?? null;
      photo_name = parsed.data.photoName ?? null;
    } else if (ct.startsWith("multipart/form-data")) {
      const form = await req.formData();

      // meal_type (obligatorio)
      const mtRaw = form.get("meal_type");
      const mtParsed = MealType.safeParse(typeof mtRaw === "string" ? mtRaw : "");
      if (!mtParsed.success) return err("INVALID_BODY", 400, { details: mtParsed.error.toString() });
      meal_type = mtParsed.data;

      // opcionales
      note       = (form.get("note") as string) ?? null;
      clientTz   = (form.get("clientTz") as string) ?? "UTC";
      recordedAt = (form.get("recordedAt") as string) ?? null;

      const file = form.get("photo");
      if (file instanceof File && file.size > 0) {
        const buf = Buffer.from(await file.arrayBuffer());
        photo_data = buf.toString("base64");
        photo_name = file.name;
      }
    } else {
      return err("UNSUPPORTED_CONTENT_TYPE", 415);
    }

    // INSERT correcto: 7 columnas → 7 valores (incluye meal_type)
    const rows = (await sql/* sql */`
      INSERT INTO records
        (user_id, meal_type, note, photo_data, photo_name, client_tz, recorded_at)
      VALUES
        (${user.id}, ${meal_type}::meal_type, ${note}, ${photo_data}, ${photo_name}, ${clientTz}, ${recordedAt})
      RETURNING id, meal_type, note, photo_name, client_tz, recorded_at, local_date, created_at
    `) as RecordRow[];

    const record = rows[0];
    if (!record) return err("FAILED_TO_CREATE_RECORD", 400);

    return ok({ record });
  } catch (e) {
    if (e instanceof Error && /token|unauthori[sz]ed|bearer|jwt/i.test(e.message)) return err("UNAUTHORIZED", 401);
    return err(e instanceof Error ? e.message : "FAILED_TO_CREATE_RECORD", 400);
  }
}
