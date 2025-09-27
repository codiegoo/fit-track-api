export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { sql } from '../_lib/db';
import { ok, err } from '../_lib/http';
export { OPTIONS } from '../_lib/http';       // ← re-exporta OPTIONS (no lo declares ni lo importes con el mismo nombre)
import { requireUser } from '../_lib/auth';
import { z } from 'zod';

const schema = z.object({
  provider: z.enum(['expo', 'fcm', 'apns']),
  token: z.string().min(10),
  device_os: z.enum(['android', 'ios', 'web']),
  device_model: z.string().optional().nullable(),
});

export async function POST(req: Request) {
  try {
    const u = requireUser(req);                     // Authorization: Bearer <accessToken>
    const body = schema.parse(await req.json());

    const [row] = await sql/*sql*/`
      INSERT INTO device_tokens (user_id, provider, token, device_os, device_model, last_seen_at)
      VALUES (${u.id}, ${body.provider}::push_provider, ${body.token},
              ${body.device_os}::platform, ${body.device_model ?? null}, now())
      ON CONFLICT (token)
      DO UPDATE SET user_id = EXCLUDED.user_id,
                    provider = EXCLUDED.provider,
                    device_os = EXCLUDED.device_os,
                    device_model = EXCLUDED.device_model,
                    last_seen_at = now(),
                    disabled_at = NULL
      RETURNING id, provider, token, device_os, device_model, last_seen_at
    `;

    return ok({ device: row });
  } catch (e: any) {
    if (e?.issues) return err(e.issues[0].message, 400);
    if (e?.message?.includes('token')) return err('Unauthorized', 401);
    return err('Failed to save device token', 400);
  }
}
