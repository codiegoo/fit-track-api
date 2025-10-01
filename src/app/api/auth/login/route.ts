// app/api/auth/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_ORIGINS = new Set<string>([
  "http://localhost:8081",   // Expo (metro) web
  "http://localhost:19006",  // Expo web
  process.env.NEXT_PUBLIC_WEB_ORIGIN ?? "", // tu dominio web prod
].filter(Boolean));

function corsFor(req: NextRequest) {
  const origin = req.headers.get("origin");
  const fromWeb = !!origin;
  const allowed = fromWeb && ALLOWED_ORIGINS.has(origin!);

  const headers = new Headers({
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-CSRF-Token",
    "Access-Control-Max-Age": "600",
    "Vary": "Origin",
  });
  if (allowed) headers.set("Access-Control-Allow-Origin", origin!);

  return { fromWeb, allowed, headers, origin };
}

export async function OPTIONS(req: NextRequest) {
  const { fromWeb, allowed, headers } = corsFor(req);
  // Si viene de un navegador con Origin no permitido -> 403
  if (fromWeb && !allowed) return new NextResponse("Origin not allowed", { status: 403, headers });
  return new NextResponse(null, { status: 204, headers });
}

// —— esquema del body ——
const LoginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
type LoginBody = z.infer<typeof LoginBody>;

// —— helpers JWT ——
const JWT_ACCESS_TTL = process.env.JWT_ACCESS_TTL ?? "15m";
const JWT_REFRESH_TTL = process.env.JWT_REFRESH_TTL ?? "30d";
const JWT_SECRET = process.env.JWT_SECRET ?? "dev-only-change-me";

function signAccess(userId: string) {
  return jwt.sign({ sub: userId, typ: "access" }, JWT_SECRET, { expiresIn: JWT_ACCESS_TTL });
}
function signRefresh(userId: string) {
  return jwt.sign({ sub: userId, typ: "refresh" }, JWT_SECRET, { expiresIn: JWT_REFRESH_TTL });
}

export async function POST(req: NextRequest) {
  const { fromWeb, allowed, headers } = corsFor(req);

  if (fromWeb && !allowed) {
    return new NextResponse("Origin not allowed", { status: 403, headers });
  }

  // parse sin any
  let data: unknown;
  try { data = await req.json(); } catch { data = {}; }
  const parsed = LoginBody.safeParse(data);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "INVALID_BODY", details: parsed.error.flatten() },
      { status: 400, headers }
    );
  }

  const { email, password } = parsed.data;

  // TODO: valida contra tu DB real (Neon, etc.)
  const userFromDb = email === "fer55@gmail.com" && password === "supersecreto"
    ? { id: "u_1", name: "Fersito", email }
    : null;

  if (!userFromDb) {
    return NextResponse.json({ ok: false, error: "INVALID_CREDENTIALS" }, { status: 401, headers });
  }

  const accessToken = signAccess(userFromDb.id);
  const refreshToken = signRefresh(userFromDb.id);

  const res = NextResponse.json(
    { ok: true, user: userFromDb, accessToken }, // RN usará este accessToken
    { status: 200, headers }
  );

  // Solo para WEB (cuando hay Origin permitido): cookie HttpOnly con refresh
  if (fromWeb && allowed) {
    res.cookies.set({
      name: "refresh_token",
      value: refreshToken,
      httpOnly: true,
      secure: true,       // obligatorio con SameSite=None
      sameSite: "none",   // cross-site (p.ej. api.tu.com y app.tu.com)
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 días
    });
  }

  return res;
}
