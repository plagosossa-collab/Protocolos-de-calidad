/**
 * Limpia las variables de Supabase: quita espacios, comillas y cualquier ruta
 * o "/" final. Una URL como "https://x.supabase.co/" produce rutas con "//" y
 * Supabase responde "Invalid path specified in request URL".
 */
export function supabaseEnv() {
  const clean = (v: string | undefined) => (v ?? "").trim().replace(/^["']|["']$/g, "").trim();
  const rawUrl = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key = clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  let url = rawUrl;
  try {
    url = new URL(rawUrl).origin;
  } catch {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL no es una URL válida (debe ser https://<proyecto>.supabase.co)");
  }
  if (!key) throw new Error("Falta NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return { url, key };
}
