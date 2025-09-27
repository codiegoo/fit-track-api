export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { sql } from '../../_lib/db';
import { ok, err } from '../../_lib/http';
export { OPTIONS } from '../../_lib/http';              // ⬅️ re-exporta el handler OPTIONS (no lo importes)
import { issueTokensForUser, type JwtUser } from '../../_lib/auth';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export async function POST(req: Request) {
  try {
    const { email, password } = schema.parse(await req.json());

    const [row] = await sql/*sql*/`
      SELECT id, email, password_hash, name, tz
      FROM users
      WHERE email = ${email} AND deleted_at IS NULL
      LIMIT 1
    `;
    if (!row) return err('Invalid credentials', 401);

    const okPass = await bcrypt.compare(password, row.password_hash);
    if (!okPass) return err('Invalid credentials', 401);

    await sql/*sql*/`UPDATE users SET last_login_at = now() WHERE id = ${row.id}`;

    // Tipar explícitamente para el helper de JWT
    const jwtUser: JwtUser = { id: row.id as string, email: row.email as string };

    const tokens = await issueTokensForUser(jwtUser, {
      userAgent: req.headers.get('user-agent'),
      ip: req.headers.get('x-forwarded-for'),
    });

    delete row.password_hash;
    return ok({ user: row, ...tokens });
  } catch (e: any) {
    if (e?.issues) return err(e.issues[0].message, 400);
    return err(e?.message || 'Login failed', 400);
  }
}
