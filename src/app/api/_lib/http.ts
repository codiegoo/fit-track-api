// src/app/api/_lib/http.ts
import { NextRequest, NextResponse } from "next/server";

export const ALLOWED_ORIGINS = [
  "http://localhost:8081",
  "http://localhost:19006",
  // agrega tu dominio prod aquí
];

export function cors(req: NextRequest) {
  const origin = req.headers.get("origin") ?? "";
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : "";
  const headers = new Headers({
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-CSRF-Token",
    "Access-Control-Max-Age": "600",
    "Vary": "Origin",
  });
  return { headers, allow };
}

export function ok(body: any, status = 200, extra?: HeadersInit) {
  const h = new Headers({ "Content-Type": "application/json", ...(extra || {}) });
  return new NextResponse(JSON.stringify(body), { status, headers: h });
}

export function err(message: string, status = 400, extra?: HeadersInit) {
  const h = new Headers({ "Content-Type": "application/json", ...(extra || {}) });
  return new NextResponse(JSON.stringify({ ok: false, error: message }), { status, headers: h });
}

export function makeOptions(req: NextRequest) {
  const { headers, allow } = cors(req);
  if (!allow) return new NextResponse("Origin not allowed", { status: 403 });
  return new NextResponse(null, { status: 204, headers });
}
