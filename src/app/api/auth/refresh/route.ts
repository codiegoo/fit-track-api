export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { ok, err } from '../../_lib/http';
export { OPTIONS } from '../../_lib/http';
import { rotateRefreshToken } from '../../_lib/auth';
import { z, ZodError } from 'zod';

const schema = z.object({ refreshToken: z.string().min(10) });

export async function POST(req: Request) {
  try {
    const { refreshToken } = schema.parse(await req.json());

    const tokens = await rotateRefreshToken(refreshToken, {
      userAgent: req.headers.get('user-agent'),
      ip: req.headers.get('x-forwarded-for'),
    });

    return ok(tokens);
  } catch (e: unknown) {
    if (e instanceof ZodError) {
      return err(e.issues[0]?.message ?? 'Invalid body', 400);
    }
    if (e instanceof Error) {
      // rotateRefreshToken lanza errores como 'Refresh not found', 'Refresh revoked', etc.
      const isAuth =
        /refresh|token|revoked|not found|mismatch|expired/i.test(e.message);
      return err(isAuth ? 'Invalid refresh token' : e.message, isAuth ? 401 : 400);
    }
    return err('Invalid refresh token', 401);
  }
}
