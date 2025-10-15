export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export { makeOptions as OPTIONS } from "../_lib/http";

import type { NextRequest } from "next/server";
import { sql } from "../_lib/db";
import { ok, err } from "../_lib/http";
import { requireUser } from "../_lib/auth";
import { z } from "zod";

// ——— Validaciones ———
const createSchema = z.object({
  meal_type: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  note: z.string().max(500).optional().nullable(),
  clientTz: z.string().min(2),
  recordedAt: z.string().datetime().optional(),
  // si es JSON
  photo: z.string().optional().nullable(), // base64 opcional
  photoName: z.string().optional().nullable(),
});

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  since: z.string().datetime().optional(),
});

type RecordRow = {
  id: string;
  meal_type: "breakfast" | "lunch" | "dinner" | "snack";
  note: string | null;
  photo_data: string | null;      // <— campo base64 o text
  photo_name: string | null;
  client_tz: string;
  recorded_at: string;
  local_date: string;
  created_at: string;
};

// ——— GET /api/records ———
export async function GET(req: NextRequest) {
  try {
    const user = requireUser(req);

    const q = Object.fromEntries(req.nextUrl.searchParams.entries());
    const parsed = listQuerySchema.safeParse(q);
    if (!parsed.success) {
      return err("INVALID_QUERY", 400, { details: parsed.error.toString() });
    }
    const { limit, since } = parsed.data;

    const rows = (await sql/*sql*/`
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
    if (e instanceof Error && /token|unauthori[sz]ed|bearer|jwt/i.test(e.message)) {
      return err("UNAUTHORIZED", 401);
    }
    return err(e instanceof Error ? e.message : "FAILED_TO_LIST_RECORDS", 400);
  }
}

// ——— POST /api/records ———
// Soporta: multipart/form-data (archivo real) o JSON (con base64)
export async function POST(req: NextRequest) {
  try {
    const user = requireUser(req);
    const contentType = req.headers.get("content-type") ?? "";

    let meal_type: any;
    let note: string | null = null;
    let clientTz = "UTC";
    let recordedAt: string | null = null;
    let photo_data: string | null = null;
    let photo_name: string | null = null;

    // —— Caso 1: JSON (React Native / Web con base64) ——
    if (contentType.includes("application/json")) {
      const body = await req.json().catch(() => ({}));
      const parsed = createSchema.safeParse(body);
      if (!parsed.success) {
        return err("INVALID_BODY", 400, { details: parsed.error.toString() });
      }
      meal_type = parsed.data.meal_type;
      note = parsed.data.note ?? null;
      clientTz = parsed.data.clientTz;
      recordedAt = parsed.data.recordedAt ?? null;
      photo_data = parsed.data.photo ?? null;
      photo_name = parsed.data.photoName ?? null;
    }
    // —— Caso 2: multipart/form-data (upload desde navegador) ——
    else if (contentType.startsWith("multipart/form-data")) {
      const form = await req.formData();
      meal_type = form.get("meal_type");
      note = (form.get("note") as string) ?? null;
      clientTz = (form.get("clientTz") as string) ?? "UTC";
      recordedAt = (form.get("recordedAt") as string) ?? null;

      const file = form.get("photo") as File | null;
      if (file && file.size > 0) {
        const arrayBuffer = await file.arrayBuffer();
        // convierte a base64 antes de guardar
        photo_data = Buffer.from(arrayBuffer).toString("base64");
        photo_name = file.name;
      }
    } else {
      return err("UNSUPPORTED_CONTENT_TYPE", 415);
    }

    const rows = (await sql/*sql*/`
      INSERT INTO records
        (user_id, meal_type, note, photo_data, photo_name, client_tz, recorded_at)
      VALUES
        (${user.id}, ${meal_type}::meal_type, ${note}, ${photo_data}, ${photo_name},
         ${clientTz}, ${recordedAt ?? null})
      RETURNING id, meal_type, note, photo_name, client_tz, recorded_at, local_date, created_at
    `) as RecordRow[];

    const record = rows?.[0];
    if (!record) return err("FAILED_TO_CREATE_RECORD", 400);

    return ok({ record });
  } catch (e) {
    if (e instanceof Error && /token|unauthori[sz]ed|bearer|jwt/i.test(e.message)) {
      return err("UNAUTHORIZED", 401);
    }
    return err(e instanceof Error ? e.message : "FAILED_TO_CREATE_RECORD", 400);
  }
}
