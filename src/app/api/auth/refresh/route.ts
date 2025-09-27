export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { ok, err } from '../../_lib/http';
export { OPTIONS } from '../../_lib/http';        // ← usa la de tu helper
import { rotateRefreshToken } from '../../_lib/auth';
import { z } from 'zod';

const schema = z.object({ refreshToken: z.string().min(10) });

export async function POST(req: Request) {
  try {
    const { refreshToken } = schema.parse(await req.json());
    const tokens = await rotateRefreshToken(refreshToken, {
      userAgent: req.headers.get('user-agent'),
      ip: req.headers.get('x-forwarded-for'),
    });
    return ok(tokens);
  } catch (e: any) {
    if (e?.issues) return err(e.issues[0].message, 400);
    return err('Invalid refresh token', 401);
  }
}
