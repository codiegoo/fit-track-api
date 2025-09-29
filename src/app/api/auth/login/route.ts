// app/api/auth/login/route.ts
import { NextRequest, NextResponse } from "next/server";

const ALLOWED_ORIGINS = [
  "http://localhost:8081", // Expo web (metro)
  "http://localhost:19006", // Expo web (dev server)
];

function makeCors(req: NextRequest) {
  const origin = req.headers.get("origin") ?? "";
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : "";

  // Si quieres admitir producción, agrega aquí tu dominio prod
  const headers = new Headers({
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Credentials": "true", // necesario porque usaremos cookie HttpOnly
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-CSRF-Token",
    "Access-Control-Max-Age": "600", // cachea preflight 10 min
    "Vary": "Origin",
  });

  return { origin, allow, headers };
}

// Preflight
export async function OPTIONS(req: NextRequest) {
  const { allow, headers } = makeCors(req);
  if (!allow) return new NextResponse("Origin not allowed", { status: 403 });
  return new NextResponse(null, { status: 204, headers });
}

// Login
export async function POST(req: NextRequest) {
  const { allow, headers } = makeCors(req);

  // Si viene desde web y el origin no está permitido, corta
  if (req.headers.get("origin") && !allow) {
    return new NextResponse("Origin not allowed", { status: 403, headers });
  }

  const { email, password } = await req.json().catch(() => ({} as any));

  if (!email || !password) {
    return new NextResponse(
      JSON.stringify({ ok: false, error: "MISSING_FIELDS" }),
      { status: 400, headers: addJson(headers) }
    );
  }

  // TODO: valida contra tu DB real
  const valid = email === "fer55@gmail.com" && password === "supersecreto";
  if (!valid) {
    return new NextResponse(
      JSON.stringify({ ok: false, error: "INVALID_CREDENTIALS" }),
      { status: 401, headers: addJson(headers) }
    );
  }

  // ==== Genera tokens reales aquí ====
  const accessToken = "ACCESS_JWT_REAL_AQUI";   // exp corto (5–15 min)
  const refreshToken = "REFRESH_JWT_REAL_AQUI"; // exp largo (7–30 días)
  const user = { id: "u_1", name: "Fersito", email };

  const res = new NextResponse(
    JSON.stringify({ ok: true, accessToken, user }),
    { status: 200, headers: addJson(headers) }
  );

  // ✅ Cookie de refresh solo para WEB (cuando hay Origin permitido).
  // En RN nativo usualmente NO hay header Origin → igual se puede setear, pero RN no la usará.
  // Si quieres limitarla a “solo web”, puedes condicionar con `if (allow) { ... }`
  res.headers.append(
    "Set-Cookie",
    [
      `refresh_token=${refreshToken}`,
      "Path=/",
      "HttpOnly",
      "Secure",        // requerido con SameSite=None
      "SameSite=None", // para CORS
      "Max-Age=2592000" // ~30 días
    ].join("; ")
  );

  return res;
}

// Helpers
function addJson(h: Headers) {
  const out = new Headers(h);
  out.set("Content-Type", "application/json");
  return out;
}
