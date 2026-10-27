import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
export const configured = () =>
  Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
export function publicDb() {
  if (!configured()) return null;
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) =>
          fetch(input, { ...init, signal: AbortSignal.timeout(8000) }),
      },
    },
  );
}
export async function sessionDb() {
  if (!configured()) return null;
  const jar = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => jar.getAll(),
        setAll: (values) => {
          for (const { name, value, options } of values)
            jar.set(name, value, options);
        },
      },
    },
  );
}
export async function requireAdmin() {
  const db = await sessionDb();
  if (!db) throw Error("NOT_CONFIGURED");
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user) throw Error("UNAUTHORIZED");
  // A função RPC usa auth.uid(), nunca metadados editáveis pelo usuário.
  const { data: allowed, error: roleError } = await db.rpc("am_i_admin");
  if (roleError || !allowed) throw Error("FORBIDDEN");
  return { db, user };
}
