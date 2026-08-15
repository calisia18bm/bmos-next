import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Client khusus buat dipakai di webhook/cron -- nggak ada sesi user
 * login, jadi butuh service role key yang bisa lewatin RLS.
 * JANGAN pernah dipakai di kode yang jalan di browser.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
