import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { sql } from './db';

export const ACCESS_TTL  = process.env.JWT_ACCESS_TTL  || '15m';
export const REFRESH_TTL = process.env.JWT_REFRESH_TTL || '30d';

export type JwtUser = { id: string; email: string };

export function getBearer(req: Request) {
  const h = req.headers.get('authorization') || '';
  const [scheme, token] = h.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token.trim() : null;
}

export function signAccessToken(user: JwtUser) {
  return jwt.sign(user, process.env.JWT_ACCESS_SECRET!, { expiresIn: ACCESS_TTL });
}
export function signRefreshToken(user: JwtUser & { jti: string }) {
  return jwt.sign(user, process.env.JWT_REFRESH_SECRET!, { expiresIn: REFRESH_TTL });
}
export function verifyAccess(token: string)  { return jwt.verify(token,  process.env.JWT_ACCESS_SECRET!)  as JwtUser; }
export function verifyRefresh(token: string) { return jwt.verify(token,  process.env.JWT_REFRESH_SECRET!) as JwtUser & { jti: string }; }

export const hashToken = (t: string) => crypto.createHash('sha256').update(t).digest('hex');
export const newId = () => crypto.randomUUID();

export async function issueTokensForUser(user: JwtUser, meta: { userAgent?: string|null; ip?: string|null } = {}) {
  const jti = newId();
  const accessToken  = signAccessToken(user);
  const refreshToken = signRefreshToken({ ...user, jti });
  const decoded = jwt.decode(refreshToken) as { exp: number };
  const expiresAt = new Date(decoded.exp * 1000).toISOString();

  await sql`
    INSERT INTO refresh_tokens (user_id, jti, token_hash, user_agent, ip_addr, expires_at)
    VALUES (${user.id}, ${jti}, ${hashToken(refreshToken)}, ${meta.userAgent || null}, ${meta.ip || null}, ${expiresAt})
  `;
  return { accessToken, refreshToken };
}

export async function rotateRefreshToken(oldToken: string, meta: { userAgent?: string|null; ip?: string|null } = {}) {
  const payload = verifyRefresh(oldToken);
  const [rt] = await sql/*sql*/`
    SELECT id, user_id, is_revoked, expires_at, jti, token_hash
    FROM refresh_tokens WHERE jti = ${payload.jti} AND user_id = ${payload.id} LIMIT 1
  `;
  if (!rt) throw new Error('Refresh not found');
  if (rt.is_revoked) throw new Error('Refresh revoked');
  if (rt.token_hash && rt.token_hash !== hashToken(oldToken)) throw new Error('Hash mismatch');

  const [user] = await sql/*sql*/`SELECT id, email FROM users WHERE id = ${payload.id} AND deleted_at IS NULL LIMIT 1`;
  if (!user) throw new Error('User not found');

  const newJti = newId();
  const newRefresh = signRefreshToken({ id: user.id, email: user.email, jti: newJti });
  const decoded = jwt.decode(newRefresh) as { exp: number };
  const expiresAt = new Date(decoded.exp * 1000).toISOString();

  await sql/*sql*/`UPDATE refresh_tokens SET is_revoked = true, replaced_by = ${newJti} WHERE jti = ${payload.jti}`;
  await sql/*sql*/`
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
