import { neon } from '@neondatabase/serverless';

export const sql = neon(process.env.DATABASE_URL!);

// Type guard para violación de UNIQUE (23505) SIN any
export function isUniqueViolation(e: unknown): e is { code: '23505' } {
  if (typeof e !== 'object' || e === null) return false;
  const code = (e as { code?: unknown }).code;
  return typeof code === 'string' && code === '23505';
}
