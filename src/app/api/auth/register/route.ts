// src/app/api/auth/register/route.ts
import { NextRequest, NextResponse } from "next/server";
import { sql, isUniqueViolation } from "../../_lib/db";
import { issueTokensForUser, type JwtUser } from "../../_lib/auth";
import bcrypt from "bcryptjs";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ——— Esquema de validación del body ———
const RegisterSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  password: z.string().min(6).max(100),
});

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  tz: string | null;
};

function clientIp(req: NextRequest) {
  const xff = req.headers.get("x-forwarded-for") || "";
  return xff.split(",")[0]?.trim() || null;
}

export async function POST(req: NextRequest) {
  // 1️⃣ Parse seguro del body
  const parsed = RegisterSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "INVALID_BODY", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { name, email, password } = parsed.data;

  // 2️⃣ Generar hash de contraseña
  const rounds = Number.parseInt(process.env.BCRYPT_SALT_ROUNDS ?? "12", 10);
  const passwordHash = await bcrypt.hash(
    password,
    Number.isFinite(rounds) ? rounds : 12
  );

  // 3️⃣ Crear usuario y emitir tokens
  try {
    const rows = (await sql/*sql*/`
      INSERT INTO users (email, password_hash, name)
      VALUES (${email}, ${passwordHash}, ${name})
      RETURNING id, email, name, tz
    `) as UserRow[];

    const user = rows?.[0];
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "REGISTER_FAILED" },
        { status: 400 }
      );
    }

    const jwtUser: JwtUser = { id: user.id, email: user.email };

    const { accessToken, refreshToken } = await issueTokensForUser(jwtUser, {
      userAgent: req.headers.get("user-agent") ?? undefined,
      ip: clientIp(req),
    });

    // 4️⃣ Devolver tokens y usuario
    // Sin cookies ni CORS: los maneja el BFF o la app móvil.
    return NextResponse.json(
      { ok: true, user, accessToken, refreshToken },
      { status: 201 }
    );
  } catch (err) {
    if (isUniqueViolation(err)) {
      return NextResponse.json(
        { ok: false, error: "EMAIL_ALREADY_REGISTERED" },
        { status: 409 }
      );
    }

    const message = err instanceof Error ? err.message : "REGISTER_FAILED";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 400 }
    );
  }
}
