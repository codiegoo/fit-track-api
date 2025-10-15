// src/app/api/auth/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
// OJO con la ruta: desde .../api/auth/login/route.ts a .../_lib/auth.ts
import { issueTokensForUser } from "../../_lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function clientIp(req: NextRequest) {
  // Vercel: X-Forwarded-For puede traer "ip1, ip2, ..."
  const xff = req.headers.get("x-forwarded-for") || "";
  return xff.split(",")[0]?.trim() || null;
}

export async function POST(req: NextRequest) {
  // 1) Parse seguro del body
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "INVALID_BODY", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { email, password } = parsed.data;

  // 2) TODO: valida contra tu BD real (demo temporal)
  const user =
    email === "fer55@gmail.com" && password === "supersecreto"
      ? { id: "u_1", email }
      : null;

  if (!user) {
    return NextResponse.json(
      { ok: false, error: "INVALID_CREDENTIALS" },
      { status: 401 }
    );
  }

  // 3) Emite tokens y registra/huellea el refresh en BD
  const { accessToken, refreshToken } = await issueTokensForUser(user, {
    userAgent: req.headers.get("user-agent"),
    ip: clientIp(req),
  });

  // 4) Devuelve ambos tokens en el body (sin CORS, sin cookies)
  //    - Web: tu BFF llamará a este endpoint y guardará el refresh en cookie httpOnly.
  //    - Android: la app guardará ambos en SecureStore.
  return NextResponse.json({
    ok: true,
    user,
    accessToken,
    refreshToken,
  });
}
