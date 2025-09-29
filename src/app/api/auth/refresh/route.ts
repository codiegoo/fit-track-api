import { NextRequest, NextResponse } from "next/server";
import { rotateRefreshToken } from "../../_lib/auth";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ refreshToken: z.string().min(10) });

function corsHeaders(req: NextRequest) {
  const origin = req.headers.get("origin") ?? "";
  const allow = [
    "http://localhost:8081",
    "http://localhost:19006",
  ].includes(origin) ? origin : "";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "600",
    "Vary": "Origin",
  };
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

export async function POST(req: NextRequest) {
  const headers = corsHeaders(req);

  try {
    // 1) WEB: intenta cookie
    const cookie = req.headers.get("cookie") ?? "";
    const match = cookie.match(/refresh_token=([^;]+)/);
    let refreshToken: string | null = match?.[1] ?? null;

    // 2) RN: body si no hubo cookie
    if (!refreshToken) {
      const body = await req.json().catch(() => ({}));
      const parsed = schema.safeParse(body);
      if (!parsed.success) {
        return new NextResponse(
          JSON.stringify({ ok: false, error: "MISSING_REFRESH" }),
          { status: 400, headers: { ...headers, "Content-Type": "application/json" } }
        );
      }
      refreshToken = parsed.data.refreshToken;
    }

    // 3) Rota
    const tokens = await rotateRefreshToken(refreshToken!, {
      userAgent: req.headers.get("user-agent"),
      ip: req.headers.get("x-forwarded-for"),
    });

    const res = new NextResponse(JSON.stringify({ ok: true, ...tokens }), {
      status: 200,
      headers: { ...headers, "Content-Type": "application/json" },
    });

    // 4) WEB: set cookie nueva
    res.headers.append(
      "Set-Cookie",
      [
        `refresh_token=${tokens.refreshToken}`,
        "Path=/",
        "HttpOnly",
        "Secure",
        "SameSite=None",
        "Max-Age=2592000",
      ].join("; ")
    );

    return res;
  } catch (e: any) {
    const isAuth = /refresh|token|revoked|not found|mismatch|expired/i.test(e?.message ?? "");
    return new NextResponse(
      JSON.stringify({ ok: false, error: isAuth ? "INVALID_REFRESH" : (e?.message || "BAD_REQUEST") }),
      { status: isAuth ? 401 : 400, headers: { ...headers, "Content-Type": "application/json" } }
    );
  }
}
