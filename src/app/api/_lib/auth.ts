import jwt from 'jsonwebtoken';               // o: import * as jwt from 'jsonwebtoken'
import crypto from 'crypto';
import { sql } from './db';

export const ACCESS_TTL  = process.env.JWT_ACCESS_TTL  || '15m';
export const REFRESH_TTL = process.env.JWT_REFRESH_TTL || '30d';

export type JwtUser = { id: string; email: string };

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name} in env`);
  return v;
}
const ACCESS_SECRET  = requiredEnv('JWT_ACCESS_SECRET');
const REFRESH_SECRET = requiredEnv('JWT_REFRESH_SECRET');

export function getBearer(req: Request) {
  const h = req.headers.get('authorization') || '';
  const [scheme, token] = h.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token.trim() : null;
}

export function signAccessToken(user: JwtUser) {
  return jwt.sign(user, ACCESS_SECRET, { expiresIn: ACCESS_TTL });
}
export function signRefreshToken(user: JwtUser & { jti: string }) {
  return jwt.sign(user, REFRESH_SECRET, { expiresIn: REFRESH_TTL });
}
export function verifyAccess(token: string)  { return jwt.verify(token,  ACCESS_SECRET)  as JwtUser; }
export function verifyRefresh(token: string) { return jwt.verify(token,  REFRESH_SECRET) as JwtUser & { jti: string }; }

export const hashToken = (t: string) => crypto.createHash('sha256').update(t).digest('hex');
export const newId = () => crypto.randomUUID();

// …(resto igual)

export async function issueTokensForUser(
  user: JwtUser,
  meta: { userAgent?: string|null; ip?: string|null } = {}
) {
  const jti = newId();
  const accessToken  = signAccessToken(user);
  const refreshToken = signRefreshToken({ ...user, jti });

  const decoded = jwt.decode(refreshToken);
  const exp = typeof decoded === 'object' && decoded && 'exp' in decoded ? (decoded as { exp: number }).exp : undefined;
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
  meta: { userAgent?: string|null; ip?: string|null } = {}
) {
  const payload = verifyRefresh(oldToken);

  const rows = await sql`
    SELECT id, user_id, is_revoked, expires_at, jti, token_hash
    FROM refresh_tokens WHERE jti = ${payload.jti} AND user_id = ${payload.id} LIMIT 1
  ` as unknown as Array<{
    id: string; user_id: string; is_revoked: boolean | null;
    expires_at: string; jti: string; token_hash: string | null;
  }>;
  const rt = rows[0];
  if (!rt) throw new Error('Refresh not found');
  if (rt.is_revoked) throw new Error('Refresh revoked');
  if (rt.token_hash && rt.token_hash !== hashToken(oldToken)) throw new Error('Hash mismatch');

  const userRows = await sql`
    SELECT id, email FROM users WHERE id = ${payload.id} AND deleted_at IS NULL LIMIT 1
  ` as unknown as Array<{ id: string; email: string }>;
  const user = userRows[0];
  if (!user) throw new Error('User not found');

  const newJti = newId();
  const newRefresh = signRefreshToken({ id: user.id, email: user.email, jti: newJti });

  const dec2 = jwt.decode(newRefresh);
  const exp2 = typeof dec2 === 'object' && dec2 && 'exp' in dec2 ? (dec2 as { exp: number }).exp : undefined;
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
