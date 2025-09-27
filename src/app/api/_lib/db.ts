import { neon } from '@neondatabase/serverless';

export const sql = neon(process.env.DATABASE_URL!);

// util opcional para detectar UNIQUE violations
export function isUniqueViolation(e: unknown) {
  return typeof e === 'object' && e !== null && (e as any).code === '23505';
}
