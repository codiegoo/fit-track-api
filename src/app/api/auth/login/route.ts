// app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_ORIGINS = [
  'http://localhost:8081', // tu web RN/Expo Web
  'http://localhost:19006', // (opcional) Expo web dev
];

function corsHeaders(req: NextRequest) {
  const origin = req.headers.get('origin') ?? '';
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : '';
  return {
    'Access-Control-Allow-Origin': allow,                  // refleja el origin
    'Access-Control-Allow-Credentials': 'true',            // para cookies/sesión
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Vary': 'Origin',                                      // importante para caches
  };
}

// Respuesta al preflight
export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

// Login real
export async function POST(req: NextRequest) {
  const headers = corsHeaders(req);
  const { email, password } = await req.json().catch(() => ({} as any));

  if (!email || !password) {
    return new NextResponse(
      JSON.stringify({ ok: false, error: 'MISSING_FIELDS' }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...headers } }
    );
  }

  // TODO: valida contra tu DB
  const valid = email === 'fer55@gmail.com' && password === 'supersecreto';

  if (!valid) {
    return new NextResponse(
      JSON.stringify({ ok: false, error: 'INVALID_CREDENTIALS' }),
      { status: 401, headers: { 'Content-Type': 'application/json', ...headers } }
    );
  }

  // Si usas cookie de sesión / JWT en cookie:
  const res = new NextResponse(
    JSON.stringify({ ok: true }),
    { status: 200, headers: { 'Content-Type': 'application/json', ...headers } }
  );

  // Ajusta nombre/valor/ttl de la cookie
  res.headers.append(
    'Set-Cookie',
    [
      `ft_session=jwt_o_lo_que_uses`,
      'Path=/',
      'HttpOnly',
      'Secure',            // requerido para SameSite=None
      'SameSite=None',     // para cross-site con localhost:8081
      'Max-Age=604800'     // 7 días
    ].join('; ')
  );

  return res;
}
