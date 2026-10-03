import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeBrand } from "@/lib/brand";

/** Usuario, empresa activa (la primera donde es admin, o la primera) y rol. Una sola consulta por request. */
export const getContext = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: mine } = await supabase
    .from("memberships")
    .select("is_admin, fixed_cargo, companies(id, name, logo_path, brand_color)")
    .eq("user_id", user.id);
  if (!mine?.length) redirect("/onboarding");

  const m = mine.find((x) => x.is_admin) ?? mine[0];
  const company = m.companies as unknown as { id: string; name: string; logo_path: string | null; brand_color: string | null };
  const logoUrl = company.logo_path
    ? supabase.storage.from("branding").getPublicUrl(company.logo_path).data.publicUrl
    : null;
  return { supabase, user, company, isAdmin: m.is_admin, cargo: m.fixed_cargo, logoUrl, brand: safeBrand(company.brand_color) };
});

export function flash(path: string, kind: "ok" | "error", text: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}${kind}=${encodeURIComponent(text)}`);
}
