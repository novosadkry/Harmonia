import "dotenv/config";
import { z } from 'zod';

const envSchema = z.object({
  DISCORD_BOT_TOKEN: z.string().min(1),
  DISCORD_CLIENT_ID: z.string().min(1),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),
  DATABASE_URL: z.string().min(1),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export const env = envSchema.parse(process.env);
