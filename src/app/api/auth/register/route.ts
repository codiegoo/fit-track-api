// app/api/auth/register/route.ts
import { NextRequest, NextResponse } from "next/server";
import { sql, isUniqueViolation } from "../../_lib/db";
import { issueTokensForUser, type JwtUser } from "../../_lib/auth";
import bcrypt from "bcryptjs";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ——— Orígenes permitidos (WEB) ———
const ALLOWED_ORIGINS = new Set<string>([
  "http://localhost:8081",
  "http://localhost:19006",
  process.env.NEXT_PUBLIC_WEB_ORIGIN ?? "", // tu dominio en prod
].filter(Boolean));

function buildCors(req: NextRequest) {
  const origin = req.headers.get("origin");
  const fromWeb = !!origin;
  const allowed = fromWeb && ALLOWED_ORIGINS.has(origin!);

  const headers = new Headers({
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-CSRF-Token",
    "Access-Control-Max-Age": "600",
    "Vary": "Origin",
  });
  if (allowed) headers.set("Access-Control-Allow-Origin", origin!);

  return { fromWeb, allowed, headers };
}

function getClientIp(req: NextRequest) {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim();
}

// ——— Validación ———
const RegisterSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  password: z.string().min(6).max(100),
});
type RegisterBody = z.infer<typeof RegisterSchema>;

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  tz: string | null;
};

// ——— Preflight ———
export async function OPTIONS(req: NextRequest) {
  const { fromWeb, allowed, headers } = buildCors(req);
  if (fromWeb && !allowed) {
    return new NextResponse("Origin not allowed", { status: 403, headers });
  }
  return new NextResponse(null, { status: 204, headers });
}

// ——— POST /register ———
export async function POST(req: NextRequest) {
  const { fromWeb, allowed, headers } = buildCors(req);

  // Bloquea navegadores con Origin no permitido (RN normalmente no manda Origin)
  if (fromWeb && !allowed) {
    return new NextResponse("Origin not allowed", { status: 403, headers });
  }

  // Parseo seguro (sin any)
  let bodyUnknown: unknown;
  try { bodyUnknown = await req.json(); } catch { bodyUnknown = {}; }
  const parsed = RegisterSchema.safeParse(bodyUnknown);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "INVALID_BODY", details: parsed.error.flatten() },
      { status: 400, headers }
    );
  }
  const { name, email, password } = parsed.data;

  // Hash
  const rounds = Number.parseInt(process.env.BCRYPT_SALT_ROUNDS ?? "12", 10);
  const passwordHash = await bcrypt.hash(password, Number.isFinite(rounds) ? rounds : 12);

  try {
    // Inserta usuario y retorna datos básicos
    // Ajusta si tu helper sql soporta genéricos; si no, castea a UserRow[]
    const rows = (await sql/*sql*/`
      INSERT INTO users (email, password_hash, name)
      VALUES (${email}, ${passwordHash}, ${name})
      RETURNING id, email, name, tz
    `) as unknown as UserRow[];

    const user = rows?.[0];
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "REGISTER_FAILED" },
        { status: 400, headers }
      );
    }

    // Emite tokens
    const jwtUser: JwtUser = { id: user.id, email: user.email };
    const { accessToken, refreshToken } = await issueTokensForUser(jwtUser, {
      userAgent: req.headers.get("user-agent") ?? undefined,
      ip: getClientIp(req),
    });

    const res = NextResponse.json(
      {
        ok: true,
        user,
        accessToken,
        refreshToken, // 👉 RN lo guardará en SecureStore
      },
      { status: 201, headers }
    );

    // 🍪 Web: set cookie HttpOnly SOLO si viene de un origin permitido
    if (fromWeb && allowed) {
      res.cookies.set({
        name: "refresh_token",
        value: refreshToken,
        httpOnly: true,
        secure: true,
        sameSite: "none",
        path: "/",
        maxAge: 60 * 60 * 24 * 30, // 30 días
      });
    }

    return res;
  } catch (err: unknown) {
    if (isUniqueViolation(err)) {
      return NextResponse.json(
        { ok: false, error: "EMAIL_ALREADY_REGISTERED" },
        { status: 409, headers }
      );
    }
    const message = err instanceof Error ? err.message : "REGISTER_FAILED";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 400, headers }
    );
  }
}
