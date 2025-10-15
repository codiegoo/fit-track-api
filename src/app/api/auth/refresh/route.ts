// src/app/api/auth/refresh/route.ts
import { NextRequest, NextResponse } from "next/server";
import { rotateRefreshToken, getBearer } from "../../_lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clientIp(req: NextRequest) {
  const xff = req.headers.get("x-forwarded-for") || "";
  return xff.split(",")[0]?.trim() || null;
}

export async function POST(req: NextRequest) {
  // Preferimos Authorization: Bearer <refresh>
  const bearer = getBearer(req);
  const cookieRefresh = req.cookies.get("refresh_token")?.value ?? null; // solo por compatibilidad
  const refreshToken = bearer ?? cookieRefresh;

  if (!refreshToken) {
    return NextResponse.json(
      { ok: false, error: "NO_REFRESH" },
      { status: 401 }
    );
  }

  try {
    const { accessToken, refreshToken: newRefresh } = await rotateRefreshToken(
      refreshToken,
      { userAgent: req.headers.get("user-agent"), ip: clientIp(req) }
    );

    // Importante: NO seteamos cookies aquí. El BFF web se encarga.
    return NextResponse.json({
      ok: true,
      accessToken,
      refreshToken: newRefresh,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "INVALID_REFRESH" },
      { status: 401 }
    );
  }
}
