// app/api/upload/presign/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export { makeOptions as OPTIONS } from "../../_lib/http";

import type { NextRequest } from "next/server";
import { ok, err } from "../../_lib/http";
import { requireUser } from "../../_lib/auth";
import { sql } from "../../_lib/db";
import { z } from "zod";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// —— Validación del body ——
const schema = z.object({
  filename: z.string().min(1),
  contentType: z
    .string()
    .min(3)
    .refine((ct) => /^image\/(jpeg|png|webp|heic|heif|gif)$/.test(ct), "Unsupported contentType"),
});
type PresignBody = z.infer<typeof schema>;

// —— S3 client ——
const s3 = new S3Client({
  region: process.env.S3_REGION!,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
  // Si usas S3 compatible (R2/MinIO), añade:
  // endpoint: process.env.S3_ENDPOINT,
  // forcePathStyle: true,
});

// Ayuda: quita paths raros y extrae extensión
function sanitizeFileName(name: string) {
  const base = name.split("/").pop()!.split("\\").pop()!; // quita rutas
  return base.replace(/[^\w.\-]/g, "_"); // deja solo seguro
}
function pickExtFrom(name: string, fallback = "jpg") {
  const dot = name.lastIndexOf(".");
  const ext = dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
  return ext || fallback;
}

type UploadRow = { id: string };

export async function POST(req: NextRequest) {
  try {
    const u = requireUser(req); // Authorization: Bearer <access>

    // Parse body sin `any`
    let bodyUnknown: unknown;
    try {
      bodyUnknown = await req.json();
    } catch {
      bodyUnknown = {};
    }
    const parsed = schema.safeParse(bodyUnknown);
    if (!parsed.success) {
      return err("INVALID_BODY", 400, { details: parsed.error.flatten() });
    }
    const { filename, contentType } = parsed.data;

    const safeName = sanitizeFileName(filename);
    const ext = pickExtFrom(safeName, "jpg");

    const key = `u/${u.id}/${new Date().toISOString().slice(0, 10)}/${crypto
      .randomUUID()
      .replace(/-/g, "")}.${ext}`;

    // Presign PUT
    const put = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET!,
      Key: key,
      ContentType: contentType,
      // Opcional: si quieres exigir que el cliente suba con ese Content-Type exacto,
      // puedes validar en un proxy o usar conditions en POST policy (otra estrategia).
      // ACL: no pongas pública aquí; mejor sirve con CloudFront o firmas de lectura.
    });

    const uploadUrl = await getSignedUrl(s3, put, { expiresIn: 60 * 5 }); // 5 min
    const fileUrl = `https://${process.env.S3_BUCKET}.s3.${process.env.S3_REGION}.amazonaws.com/${key}`;

    // Guarda registro de upload
    const rows = (await sql/* sql */`
      INSERT INTO uploads (user_id, storage_key, url, content_type, status)
      VALUES (${u.id}, ${key}, ${fileUrl}, ${contentType}, 'pending'::file_status)
      RETURNING id
    `) as unknown as UploadRow[];

    const up = rows?.[0];
    if (!up) return err("FAILED_TO_PRESIGN", 400);

    return ok({ uploadUrl, fileUrl, uploadId: up.id });
  } catch (e) {
    if (e instanceof Error && /token|unauthori[sz]ed|bearer|jwt/i.test(e.message)) {
      return err("Unauthorized", 401);
    }
    if (e instanceof Error) {
      return err(e.message || "Failed to presign", 400);
    }
    return err("Failed to presign", 400);
  }
}
