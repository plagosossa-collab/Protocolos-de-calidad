import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseEnv } from "./env";

/**
 * Cliente con la clave secreta: salta RLS. Solo para código de servidor que ya
 * verificó que quien llama es administrador. Nunca importar desde componentes cliente.
 */
export function createAdminClient() {
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  if (!key) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY");
  return createClient(supabaseEnv().url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
