/**
 * Supabase configuration via environment variables.
 * Public values (anon key, project URL) come from NEXT_PUBLIC_* and ship to
 * the browser. Service-role key is server-only and MUST NEVER appear in any
 * file under apps/web/src/app/ that is not marked "use server" or under /api.
 *
 * See docs/spec.md section 6 (non-functional / security) for full rules.
 */

const required = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${key}. ` +
        "See .env.example for the full list.",
    );
  }
  return value;
};

export const supabaseEnv = {
  url: (): string => required("NEXT_PUBLIC_SUPABASE_URL"),
  anonKey: (): string => required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  serviceRoleKey: (): string => required("SUPABASE_SERVICE_ROLE_KEY"),
} as const;
