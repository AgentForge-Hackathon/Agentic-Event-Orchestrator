import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Supabase
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // LLM
  OPENAI_API_KEY: z.string().optional(),

  // Bright Data (Discovery Agent)
  BRIGHT_DATA_CUSTOMER_ID: z.string().optional(),
  BRIGHT_DATA_ZONE: z.string().optional(),
  BRIGHT_DATA_PASSWORD: z.string().optional(),

  // Bright Data Direct API
  BRIGHT_DATA_API_KEY: z.string().optional(),

  // ActionBook (Execution Agent)
  ACTIONBOOK_API_KEY: z.string().optional(),

  // EventFinda (Discovery Agent — REST API)
  EVENTFINDA_USERNAME: z.string().optional(),
  EVENTFINDA_PASSWORD: z.string().optional(),

  // Optional integrations
  GOOGLE_MAPS_API_KEY: z.string().optional(),
  WEATHER_API_KEY: z.string().optional(),

  // MongoDB connection string
  MONGO_URI: z.string().min(1),

  // Feature flags
  DEMO_MODE: z.coerce.boolean().default(false),
  TRACE_VERBOSE: z.coerce.boolean().default(false),
});

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error('❌ Invalid environment variables:');
    for (const issue of parsed.error.issues) {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(1);
  }

  return parsed.data;
}

export const env = loadEnv();
export type Env = z.infer<typeof envSchema>;
