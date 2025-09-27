import jwt, { type Secret, type SignOptions, type JwtPayload } from 'jsonwebtoken';
import crypto from 'crypto';
import { sql } from './db';

export const ACCESS_TTL  = process.env.JWT_ACCESS_TTL  ?? '15m';
export const REFRESH_TTL = process.env.JWT_REFRESH_TTL ?? '30d';

export type JwtUser = { id: string; email: string };

const getSecret = (name: string): Secret => {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name} in env`);
  return v as Secret;
};

const ACCESS_SECRET: Secret  = getSecret('JWT_ACCESS_SECRET');
const REFRESH_SECRET: Secret = getSecret('JWT_REFRESH_SECRET');

export function getBearer(req: Request) {
  const h = req.headers.get('authorization') || '';
  const [scheme, token] = h.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token.trim() : null;
}

export function signAccessToken(user: JwtUser) {
  const opts: SignOptions = { expiresIn: ACCESS_TTL };
  return jwt.sign(user, ACCESS_SECRET, opts);
}

export function signRefreshToken(user: JwtUser & { jti: string }) {
  const opts: SignOptions = { expiresIn: REFRESH_TTL };
  return jwt.sign(user, REFRESH_SECRET, opts);
}

/** Verifica y asegura que el payload tenga id+email */
export function verifyAccess(token: string): JwtUser {
  const dec = jwt.verify(token, ACCESS_SECRET) as JwtPayload | string;
  if (typeof dec === 'string' || !dec?.id || !dec?.email) {
    throw new Error('Invalid access token payload');
  }
  return { id: dec.id as string, email: dec.email as string };
}

export function verifyRefresh(token: string): JwtUser & { jti: string } {
  const dec = jwt.verify(token, REFRESH_SECRET) as JwtPayload | string;
  if (typeof dec === 'string' || !dec?.id || !dec?.email || !dec?.jti) {
    throw new Error('Invalid refresh token payload');
  }
  return { id: dec.id as string, email: dec.email as string, jti: dec.jti as string };
}

export const hashToken = (t: string) => crypto.createHash('sha256').update(t).digest('hex');
export const newId = () => crypto.randomUUID();

export async function issueTokensForUser(
  user: JwtUser,
  meta: { userAgent?: string | null; ip?: string | null } = {}
) {
  const jti = newId();
  const accessToken  = signAccessToken(user);
  const refreshToken = signRefreshToken({ ...user, jti });

  const dec = jwt.decode(refreshToken) as JwtPayload | null;
  const exp = dec?.exp;
  if (!exp) throw new Error('JWT decode failed');

  const expiresAt = new Date(exp * 1000).toISOString();

  await sql`
    INSERT INTO refresh_tokens (user_id, jti, token_hash, user_agent, ip_addr, expires_at)
    VALUES (${user.id}, ${jti}, ${hashToken(refreshToken)}, ${meta.userAgent || null}, ${meta.ip || null}, ${expiresAt})
  `;
  return { accessToken, refreshToken };
}

export async function rotateRefreshToken(
  oldToken: string,
  meta: { userAgent?: string | null; ip?: string | null } = {}
) {
  const payload = verifyRefresh(oldToken);

  const rows = await sql`
    SELECT id, user_id, is_revoked, expires_at, jti, token_hash
    FROM refresh_tokens
    WHERE jti = ${payload.jti} AND user_id = ${payload.id}
    LIMIT 1
  ` as unknown as Array<{
    id: string;
    user_id: string;
    is_revoked: boolean | null;
    expires_at: string;
    jti: string;
    token_hash: string | null;
  }>;

  const rt = rows[0];
  if (!rt) throw new Error('Refresh not found');
  if (rt.is_revoked) throw new Error('Refresh revoked');
  if (rt.token_hash && rt.token_hash !== hashToken(oldToken)) throw new Error('Hash mismatch');

  const userRows = await sql`
    SELECT id, email
    FROM users
    WHERE id = ${payload.id} AND deleted_at IS NULL
    LIMIT 1
  ` as unknown as Array<{ id: string; email: string }>;
  const user = userRows[0];
  if (!user) throw new Error('User not found');

  const newJti = newId();
  const newRefresh = signRefreshToken({ id: user.id, email: user.email, jti: newJti });

  const dec2 = jwt.decode(newRefresh) as JwtPayload | null;
  const exp2 = dec2?.exp;
  if (!exp2) throw new Error('JWT decode failed');

  const expiresAt = new Date(exp2 * 1000).toISOString();

  await sql`UPDATE refresh_tokens SET is_revoked = true, replaced_by = ${newJti} WHERE jti = ${payload.jti}`;
  await sql`
    INSERT INTO refresh_tokens (user_id, jti, token_hash, user_agent, ip_addr, expires_at)
    VALUES (${user.id}, ${newJti}, ${hashToken(newRefresh)}, ${meta.userAgent || null}, ${meta.ip || null}, ${expiresAt})
  `;

  const accessToken = signAccessToken({ id: user.id, email: user.email });
  return { accessToken, refreshToken: newRefresh };
}

export function requireUser(req: Request) {
  const token = getBearer(req);
  if (!token) throw new Error('No token');
  return verifyAccess(token);
}
