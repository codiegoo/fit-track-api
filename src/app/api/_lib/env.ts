import { z } from "zod";

// Nada de: import process from "node:process"

const EnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  // agrega más si los usas...
});

// Tip a TS: los env pueden ser undefined
export const ENV = EnvSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET,
} satisfies Record<string, string | undefined>);
