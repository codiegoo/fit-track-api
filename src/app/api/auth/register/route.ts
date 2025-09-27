export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { sql, isUniqueViolation } from '../../_lib/db';
import { ok, err } from '../../_lib/http';
export { OPTIONS } from '../../_lib/http';

import { issueTokensForUser, type JwtUser } from '../../_lib/auth';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  password: z.string().min(6).max(100),
});

export async function POST(req: Request) {
  try {
    const { name, email, password } = schema.parse(await req.json());
    const hash = await bcrypt.hash(password, 12);

    const [row] = await sql/*sql*/`
      INSERT INTO users (email, password_hash, name)
      VALUES (${email}, ${hash}, ${name})
      RETURNING id, email, name, tz
    `;

    // Tipar explícitamente lo que necesitas para JWT
    const jwtUser: JwtUser = { id: row.id as string, email: row.email as string };

    const tokens = await issueTokensForUser(jwtUser, {
      userAgent: req.headers.get('user-agent'),
      ip: req.headers.get('x-forwarded-for'),
    });

    return ok({ user: row, ...tokens });
  } catch (e: any) {
    if (isUniqueViolation(e)) return err('Email already registered', 409);
    if (e?.issues) return err(e.issues[0].message, 400);
    return err(e?.message || 'Register failed', 400);
  }
}
