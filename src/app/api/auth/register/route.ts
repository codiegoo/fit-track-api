export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { sql, isUniqueViolation } from '../../_lib/db';
import { ok, err } from '../../_lib/http';
export { OPTIONS } from '../../_lib/http';

import { issueTokensForUser, type JwtUser } from '../../_lib/auth';
import bcrypt from 'bcryptjs';
import { z, ZodError } from 'zod';

const schema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  password: z.string().min(6).max(100),
});

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  tz: string;
};

export async function POST(req: Request) {
  try {
    const { name, email, password } = schema.parse(await req.json());
    const hash = await bcrypt.hash(password, 12);

    const rows = await sql/*sql*/`
      INSERT INTO users (email, password_hash, name)
      VALUES (${email}, ${hash}, ${name})
      RETURNING id, email, name, tz
    ` as unknown as UserRow[];

    const row = rows[0];
    if (!row) return err('Register failed', 400); // salvaguarda

    const jwtUser: JwtUser = { id: row.id, email: row.email };

    const tokens = await issueTokensForUser(jwtUser, {
      userAgent: req.headers.get('user-agent'),
      ip: req.headers.get('x-forwarded-for'),
    });

    return ok({ user: row, ...tokens });
  } catch (e: unknown) {
    if (isUniqueViolation(e)) return err('Email already registered', 409);
    if (e instanceof ZodError) return err(e.issues[0]?.message ?? 'Invalid body', 400);
    if (e instanceof Error)   return err(e.message || 'Register failed', 400);
    return err('Register failed', 400);
  }
}
