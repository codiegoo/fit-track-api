// app/api/auth/register/route.ts
import { NextRequest, NextResponse } from "next/server";
import { sql, isUniqueViolation } from "../../_lib/db";
import { issueTokensForUser, type JwtUser } from "../../_lib/auth";
import bcrypt from "bcryptjs";
import { z, ZodError } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_ORIGINS = [
  "http://localhost:8081",
  "http://localhost:19006",
  // añade tu dominio de producción aquí
];

function corsHeaders(req: NextRequest) {
  const origin = req.headers.get("origin") ?? "";
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : "";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-CSRF-Token",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

const schema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  password: z.string().min(6).max(100),
});

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  tz: string;
};

export async function POST(req: NextRequest) {
  const headers = corsHeaders(req);

  try {
    const { name, email, password } = schema.parse(await req.json());

    // Hash
    const hash = await bcrypt.hash(password, 12);

    // Inserta usuario
    const rows = (await sql/*sql*/`
      INSERT INTO users (email, password_hash, name)
      VALUES (${email}, ${hash}, ${name})
      RETURNING id, email, name, tz
    `) as unknown as UserRow[];

    const user = rows?.[0];
    if (!user) {
      return new NextResponse(JSON.stringify({ ok: false, error: "Register failed" }), {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    // Emite tokens
    const jwtUser: JwtUser = { id: user.id, email: user.email };
    const { accessToken, refreshToken } = await issueTokensForUser(jwtUser, {
      userAgent: req.headers.get("user-agent"),
      ip: req.headers.get("x-forwarded-for"),
    });

    // Respuesta + cookie (web)
    const res = new NextResponse(
      JSON.stringify({ ok: true, user, accessToken, refreshToken }),
      { status: 200, headers: { ...headers, "Content-Type": "application/json" } }
    );

    // Set-Cookie para web (HttpOnly)
    res.headers.append(
      "Set-Cookie",
      [
        `refresh_token=${refreshToken}`,
        "Path=/",
        "HttpOnly",
        "Secure",
        "SameSite=None",
        "Max-Age=2592000", // ~30 días
      ].join("; ")
    );

    return res;
  } catch (e: any) {
    if (isUniqueViolation(e)) {
      return new NextResponse(JSON.stringify({ ok: false, error: "Email already registered" }), {
        status: 409,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }
    if (e instanceof ZodError) {
      return new NextResponse(JSON.stringify({ ok: false, error: e.issues[0]?.message ?? "Invalid body" }), {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }
    return new NextResponse(JSON.stringify({ ok: false, error: e?.message || "Register failed" }), {
      status: 400,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
}
