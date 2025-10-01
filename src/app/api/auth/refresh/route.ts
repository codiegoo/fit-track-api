// app/api/auth/refresh/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rotateRefreshToken } from "../../_lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ——— Orígenes permitidos para WEB ———
const ALLOWED_ORIGINS = new Set<string>([
  "http://localhost:8081",
  "http://localhost:19006",
  process.env.NEXT_PUBLIC_WEB_ORIGIN ?? "",
].filter(Boolean));

function buildCors(req: NextRequest) {
  const origin = req.headers.get("origin");
  const fromWeb = !!origin;
  const allowed = fromWeb && ALLOWED_ORIGINS.has(origin!);

  const headers = new Headers({
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "600",
    "Vary": "Origin",
  });
  if (allowed) headers.set("Access-Control-Allow-Origin", origin!);

  return { fromWeb, allowed, headers };
}

function getClientIp(req: NextRequest) {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim();
  // En dev podría venir vacío; no uses req.ip en runtimes serverless
  return undefined;
}

// —— esquema del body (para RN) ——
const RefreshBody = z.object({ refreshToken: z.string().min(10) });
type RefreshBody = z.infer<typeof RefreshBody>;

// ——— Preflight ———
export async function OPTIONS(req: NextRequest) {
  const { fromWeb, allowed, headers } = buildCors(req);
  // Si viene del navegador con origin no permitido → 403
  if (fromWeb && !allowed) {
    return new NextResponse("Origin not allowed", { status: 403, headers });
  }
  return new NextResponse(null, { status: 204, headers });
}

// ——— POST /refresh ———
export async function POST(req: NextRequest) {
  const { fromWeb, allowed, headers } = buildCors(req);

  // Bloquea navegadores con Origin no permitido
  if (fromWeb && !allowed) {
    return new NextResponse("Origin not allowed", { status: 403, headers });
  }

  // 1) WEB: intenta cookie HttpOnly
  let refreshToken = req.cookies.get("refresh_token")?.value ?? null;

  // 2) RN: si no hubo cookie, intenta body (sin any)
  if (!refreshToken) {
    let bodyUnknown: unknown;
    try {
      bodyUnknown = await req.json();
    } catch {
      bodyUnknown = {};
    }
    const parsed = RefreshBody.safeParse(bodyUnknown);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "MISSING_REFRESH", details: parsed.error.flatten() },
        { status: 400, headers }
      );
    }
    refreshToken = parsed.data.refreshToken;
  }

  // 3) Rota el refresh token
  try {
    const tokens = await rotateRefreshToken(refreshToken!, {
      userAgent: req.headers.get("user-agent") ?? undefined,
      ip: getClientIp(req),
    });

    // tokens debe incluir al menos: { accessToken: string, refreshToken: string, user?: ... }
    const res = NextResponse.json({ ok: true, ...tokens }, { status: 200, headers });

    // 4) WEB: set cookie nueva solo si viene de origen web permitido
    if (fromWeb && allowed) {
      res.cookies.set({
        name: "refresh_token",
        value: tokens.refreshToken,
        httpOnly: true,
        secure: true,
        sameSite: "none",
        path: "/",
        maxAge: 60 * 60 * 24 * 30, // 30 días
      });
    }

    return res;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const looksAuth = /refresh|token|revoked|not found|mismatch|expired/i.test(msg);
    return NextResponse.json(
      { ok: false, error: looksAuth ? "INVALID_REFRESH" : "BAD_REQUEST" },
      { status: looksAuth ? 401 : 400, headers }
    );
  }
}
