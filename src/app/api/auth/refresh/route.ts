export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { rotateRefreshToken, getBearer } from "../../_lib/auth";

function clientIp(req: NextRequest): string | null {
  const xff = req.headers.get("x-forwarded-for") ?? "";
  const first = xff.split(",")[0]?.trim();
  return first && first.length > 0 ? first : null;
}

export async function POST(req: NextRequest) {
  const bearer = getBearer(req);
  const cookieRefresh = req.cookies.get("refresh_token")?.value ?? null; // compat opcional
  const refreshToken = bearer ?? cookieRefresh;

  if (!refreshToken) {
    return NextResponse.json({ ok: false, error: "NO_REFRESH" }, { status: 401 });
  }

  try {
    const { accessToken, refreshToken: newRefresh } = await rotateRefreshToken(refreshToken, {
      userAgent: req.headers.get("user-agent"),
      ip: clientIp(req),
    });

    // No seteamos cookies aquí (eso lo hace el BFF web si lo usas)
    return NextResponse.json({ ok: true, accessToken, refreshToken: newRefresh });
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_REFRESH" }, { status: 401 });
  }
}
