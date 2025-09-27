export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { sql } from '../../_lib/db';
import { ok, err } from '../../_lib/http';
export { OPTIONS } from '../../_lib/http';
import { issueTokensForUser } from '../../_lib/auth';
import bcrypt from 'bcryptjs';
import { z, ZodError } from 'zod';

const schema = z.object({ email: z.string().email(), password: z.string().min(6) });

type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  name: string | null;
  tz: string;
};

export async function POST(req: Request) {
  try {
    const { email, password } = schema.parse(await req.json());

    const rows = await sql`
      SELECT id, email, password_hash, name, tz
      FROM users
      WHERE email = ${email} AND deleted_at IS NULL
      LIMIT 1
    ` as unknown as UserRow[];

    const row = rows[0];
    if (!row) return err('Invalid credentials', 401);

    const okPass = await bcrypt.compare(password, row.password_hash);
    if (!okPass) return err('Invalid credentials', 401);

    await sql`UPDATE users SET last_login_at = now() WHERE id = ${row.id}`;


    const tokens = await issueTokensForUser({ id: row.id, email: row.email }, { /* meta */ });

    // No creamos la variable password_hash
    const user: Omit<UserRow, 'password_hash'> = {
      id: row.id,
      email: row.email,
      name: row.name,
      tz: row.tz,
    };

    return ok({ user, ...tokens });
  } catch (e: unknown) {
    if (e instanceof ZodError) return err(e.issues[0]?.message ?? 'Validation error', 400);
    if (e instanceof Error)    return err(e.message || 'Login failed', 400);
    return err('Login failed', 400);
  }
}
