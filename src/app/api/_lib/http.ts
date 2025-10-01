// src/app/api/_lib/http.ts
import { NextRequest, NextResponse } from "next/server";

// ——— CORS ———
export const ALLOWED_ORIGINS = [
  "http://localhost:8081",
  "http://localhost:19006",
  process.env.NEXT_PUBLIC_WEB_ORIGIN ?? "", // agrega tu dominio prod aquí
].filter(Boolean) as readonly string[];

export function cors(req: NextRequest) {
  const origin = req.headers.get("origin") ?? "";
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : "";
  const headers = new Headers({
    "Access-Control-Allow-Origin": allow, // vacío si no permitido
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-CSRF-Token",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  });
  return { headers, allow };
}

// ——— Respuestas JSON (sin any) ———
export function ok<T>(
  body: T,
  status = 200,
  extra?: HeadersInit
): NextResponse {
  const h = new Headers({ "Content-Type": "application/json" });
  if (extra) new Headers(extra).forEach((v, k) => h.set(k, v));
  return new NextResponse(JSON.stringify(body), { status, headers: h });
}

export function err(
  message: string,
  status = 400,
  extra?: HeadersInit
): NextResponse {
  const h = new Headers({ "Content-Type": "application/json" });
  if (extra) new Headers(extra).forEach((v, k) => h.set(k, v));
  return new NextResponse(JSON.stringify({ ok: false, error: message }), {
    status,
    headers: h,
  });
}

// ——— Variante con CORS (útil para respuestas a fetch del navegador) ———
// Si quieres que TODAS las respuestas normales incluyan ACAO cuando el origin es válido,
// usa estas funciones en tus rutas y pásales el `req`.
export function okWithCors<T>(
  req: NextRequest,
  body: T,
  status = 200,
  extra?: HeadersInit
): NextResponse {
  const { headers: ch } = cors(req);
  const h = new Headers(ch);
  h.set("Content-Type", "application/json");
  if (extra) new Headers(extra).forEach((v, k) => h.set(k, v));
  return new NextResponse(JSON.stringify(body), { status, headers: h });
}

export function errWithCors(
  req: NextRequest,
  message: string,
  status = 400,
  extra?: HeadersInit
): NextResponse {
  const { headers: ch } = cors(req);
  const h = new Headers(ch);
  h.set("Content-Type", "application/json");
  if (extra) new Headers(extra).forEach((v, k) => h.set(k, v));
  return new NextResponse(JSON.stringify({ ok: false, error: message }), {
    status,
    headers: h,
  });
}

// ——— Preflight ———
export function makeOptions(req: NextRequest): NextResponse {
  const { headers, allow } = cors(req);
  if (!allow) {
    // devolvemos 403 y aún así variamos por Origin para caches
    const h = new Headers(headers);
    return new NextResponse("Origin not allowed", { status: 403, headers: h });
  }
  return new NextResponse(null, { status: 204, headers });
}
