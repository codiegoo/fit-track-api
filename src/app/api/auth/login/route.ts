// app/api/auth/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { issueTokensForUser } from "../../_lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_ORIGINS = new Set<string>([
  "http://localhost:8081",
  "http://localhost:19006",
  process.env.NEXT_PUBLIC_WEB_ORIGIN ?? "",
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
    Vary: "Origin",
  });
  if (allowed) headers.set("Access-Control-Allow-Origin", origin!);

  return { fromWeb, allowed, headers, origin };
}

export async function OPTIONS(req: NextRequest) {
  const { fromWeb, allowed, headers } = corsFor(req);
  if (fromWeb && !allowed) return new NextResponse("Origin not allowed", { status: 403, headers });
  return new NextResponse(null, { status: 204, headers });
}

// —— esquema del body ——
const LoginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
type LoginBody = z.infer<typeof LoginBody>;

export async function POST(req: NextRequest) {
  const { fromWeb, allowed, headers } = corsFor(req);

  if (fromWeb && !allowed) {
    return new NextResponse("Origin not allowed", { status: 403, headers });
  }

  // parse sin any
  let data: unknown;
  try {
    data = await req.json();
  } catch {
    data = {};
  }
  const parsed = LoginBody.safeParse(data);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "INVALID_BODY", details: parsed.error.flatten() },
      { status: 400, headers }
    );
  }

  const { email, password } = parsed.data;

  // TODO: valida contra tu DB real
  const userFromDb =
    email === "fer55@gmail.com" && password === "supersecreto"
      ? { id: "u_1", name: "Fersito", email }
      : null;

  if (!userFromDb) {
    return NextResponse.json(
      { ok: false, error: "INVALID_CREDENTIALS" },
      { status: 401, headers }
    );
  }

  // ✅ Usa helper centralizado: firma JWTs y registra refresh en DB
  const { accessToken, refreshToken } = await issueTokensForUser(
    { id: userFromDb.id, email: userFromDb.email },
    {
      userAgent: req.headers.get("user-agent"),
      ip: req.headers.get("x-forwarded-for"),
    }
  );

  const res = NextResponse.json(
    { ok: true, user: userFromDb, accessToken },
    { status: 200, headers }
  );

  // Solo para WEB (cuando hay Origin permitido): cookie HttpOnly con refresh
  if (fromWeb && allowed) {
    res.cookies.set({
      name: "refresh_token",
      value: refreshToken,
      httpOnly: true,
      secure: true, // obligatorio con SameSite=None
      sameSite: "none",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 días
    });
  }

  return res;
}
