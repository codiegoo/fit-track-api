export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { ok, err } from '../../_lib/http';
export { OPTIONS } from '../../_lib/http';                // ← re-exporta OPTIONS (no lo declares)
import { requireUser } from '../../_lib/auth';
import { sql } from '../../_lib/db';
import { z } from 'zod';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const schema = z.object({
  filename: z.string().min(1),
  contentType: z.string().min(3),
});

const s3 = new S3Client({
  region: process.env.S3_REGION!,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
});

export async function POST(req: Request) {
  try {
    const u = requireUser(req);
    const { filename, contentType } = schema.parse(await req.json());

    const ext = filename.includes('.') ? filename.split('.').pop() : 'jpg';
    const key = `u/${u.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

    const put = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET!,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(s3, put, { expiresIn: 300 }); // 5 min
    const fileUrl = `https://${process.env.S3_BUCKET}.s3.${process.env.S3_REGION}.amazonaws.com/${key}`;

    const [up] = await sql/*sql*/`
      INSERT INTO uploads (user_id, storage_key, url, content_type, status)
      VALUES (${u.id}, ${key}, ${fileUrl}, ${contentType}, 'pending'::file_status)
      RETURNING id
    `;

    return ok({ uploadUrl, fileUrl, uploadId: up.id });
  } catch (e: any) {
    if (e?.issues) return err(e.issues[0].message, 400);
    if (e?.message?.includes('token')) return err('Unauthorized', 401);
    return err('Failed to presign', 400);
  }
}
