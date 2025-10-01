// app/api/device-tokens/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import type { NextRequest } from "next/server";
import { sql } from "../_lib/db";
import { ok, err } from "../_lib/http";
export { makeOptions as OPTIONS } from "../_lib/http"; // Preflight centralizado
import { requireUser } from "../_lib/auth";
import { z } from "zod";

// —— Validación del body ——
// provider y device_os deben mapear a tus enums de Postgres: push_provider y platform
const schema = z.object({
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
  last_seen_at: string; // timestamptz ISO desde Postgres
};

export async function POST(req: NextRequest) {
  try {
    // 1) Auth: requiere Authorization: Bearer <accessToken>
    const u = requireUser(req); // lanza error si no hay token o es inválido

    // 2) Body tipado sin `any`
    let bodyUnknown: unknown;
    try {
      bodyUnknown = await req.json();
    } catch {
      bodyUnknown = {};
    }
    const parsed = schema.safeParse(bodyUnknown);
    if (!parsed.success) {
      return err("INVALID_BODY", 400, { details: parsed.error.flatten() });
    }
    const body = parsed.data;

    // 3) UPSERT (conflicto por token): reasigna user, actualiza metadatos y re-habilita
    const rows = (await sql/* sql */`
      INSERT INTO device_tokens (user_id, provider, token, device_os, device_model, last_seen_at)
      VALUES (
        ${u.id},
        ${body.provider}::push_provider,
        ${body.token},
        ${body.device_os}::platform,
        ${body.device_model ?? null},
        now()
      )
      ON CONFLICT (token)
      DO UPDATE SET
        user_id = EXCLUDED.user_id,
        provider = EXCLUDED.provider,
        device_os = EXCLUDED.device_os,
        device_model = EXCLUDED.device_model,
        last_seen_at = now(),
        disabled_at = NULL
      RETURNING id, provider, token, device_os, device_model, last_seen_at
    `) as unknown as DeviceRow[];

    const device = rows?.[0];
    if (!device) return err("FAILED_TO_SAVE_DEVICE_TOKEN", 400);

    return ok({ device }); // usa tu helper para JSON + CORS
  } catch (e) {
    // Errores de auth y genéricos
    if (e instanceof Error && /token|unauthori[sz]ed|bearer|jwt/i.test(e.message)) {
      return err("UNAUTHORIZED", 401);
    }
    if (e instanceof Error) {
      return err(e.message || "FAILED_TO_SAVE_DEVICE_TOKEN", 400);
    }
    return err("FAILED_TO_SAVE_DEVICE_TOKEN", 400);
  }
}
