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
    Vary: "Origin",
  });
  if (allowed) headers.set("Access-Control-Allow-Origin", origin!);

  return { fromWeb, allowed, headers };
}

function getClientIp(req: NextRequest) {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim();
}

// —— esquema del body (para RN) ——
const RefreshBody = z.object({ refreshToken: z.string().min(10) });

export async function OPTIONS(req: NextRequest) {
  const { fromWeb, allowed, headers } = buildCors(req);
  if (fromWeb && !allowed) {
    return new NextResponse("Origin not allowed", { status: 403, headers });
  }
  return new NextResponse(null, { status: 204, headers });
}

export async function POST(req: NextRequest) {
  const { fromWeb, allowed, headers } = buildCors(req);

  if (fromWeb && !allowed) {
    return new NextResponse("Origin not allowed", { status: 403, headers });
  }

  // 1) WEB: cookie HttpOnly
  let refreshToken = req.cookies.get("refresh_token")?.value ?? null;

  // 2) RN: body JSON si no hubo cookie
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

  // 3) Rotar refresh usando helper centralizado (firma + persistencia)
  try {
    const tokens = await rotateRefreshToken(refreshToken!, {
      userAgent: req.headers.get("user-agent") ?? undefined,
      ip: getClientIp(req),
    });

    const res = NextResponse.json({ ok: true, ...tokens }, { status: 200, headers });

    // 4) WEB: set cookie nueva sólo si origin permitido
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
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const looksAuth = /refresh|token|revoked|not found|mismatch|expired/i.test(msg);
    return NextResponse.json(
      { ok: false, error: looksAuth ? "INVALID_REFRESH" : "BAD_REQUEST" },
      { status: looksAuth ? 401 : 400, headers }
    );
  }
}
