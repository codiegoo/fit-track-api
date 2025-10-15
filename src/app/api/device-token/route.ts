// src/app/api/device-tokens/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import type { NextRequest } from "next/server";
import { sql } from "../_lib/db";
import { ok, err } from "../_lib/http";
// Si tu _lib/http expone un OPTIONS genérico 204, puedes mantenerlo.
// Si no lo necesitas, elimina la siguiente línea.
export { makeOptions as OPTIONS } from "../_lib/http";

import { requireUser } from "../_lib/auth";
import { z } from "zod";

// —— Validación del body ——
// Nota: si algún día agregas web push, añade "webpush" al enum de provider.
const DeviceTokenSchema = z.object({
  provider: z.enum(["expo", "fcm", "apns"]),
  token: z.string().min(10),
  device_os: z.enum(["android", "ios", "web"]),
  device_model: z.string().optional().nullable(),
});

type DeviceRow = {
  id: string;
  provider: "expo" | "fcm" | "apns";
  token: string;
  device_os: "android" | "ios" | "web";
  device_model: string | null;
  last_seen_at: string;
};

export async function POST(req: NextRequest) {
  try {
    // 1) Auth por access token (Authorization: Bearer <access>)
    const user = requireUser(req);

    // 2) Parse seguro del body
    const bodyUnknown = await req.json().catch(() => ({}));
    const parsed = DeviceTokenSchema.safeParse(bodyUnknown);
    if (!parsed.success) {
      return err("INVALID_BODY", 400, { details: parsed.error.toString() });
    }
    const body = parsed.data;

    // 3) UPSERT por token (idempotente)
    //    - Si ya existe, se reasigna al usuario actual, se reactivan/actualizan campos y last_seen_at.
    const rows = (await sql/*sql*/`
      INSERT INTO device_tokens (user_id, provider, token, device_os, device_model, last_seen_at)
      VALUES (
        ${user.id},
        ${body.provider}::push_provider,
        ${body.token},
        ${body.device_os}::platform,
        ${body.device_model ?? null},
        now()
      )
      ON CONFLICT (token)
      DO UPDATE SET
        user_id      = EXCLUDED.user_id,
        provider     = EXCLUDED.provider,
        device_os    = EXCLUDED.device_os,
        device_model = EXCLUDED.device_model,
        last_seen_at = now(),
        disabled_at  = NULL
      RETURNING id, provider, token, device_os, device_model, last_seen_at
    `) as DeviceRow[];

    const device = rows[0];
    if (!device) return err("FAILED_TO_SAVE_DEVICE_TOKEN", 400);

    return ok({ device }); // { ok:true, device }
  } catch (e) {
    // Errores típicos de auth / bearer / jwt → 401
    if (e instanceof Error && /token|unauthori[sz]ed|bearer|jwt/i.test(e.message)) {
      return err("UNAUTHORIZED", 401);
    }
    return err(
      e instanceof Error ? e.message : "FAILED_TO_SAVE_DEVICE_TOKEN",
      400
    );
  }
}
