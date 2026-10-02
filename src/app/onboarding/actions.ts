"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createCompany(formData: FormData) {
  const supabase = await createClient();
  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  const { error } = await supabase.rpc("create_company", { p_name: name, p_slug: slug });
  if (error) {
    const text = error.code === "23505" ? "Ese identificador ya está en uso" : "No se pudo crear la empresa. Revisa los datos.";
    redirect(`/onboarding?error=${encodeURIComponent(text)}`);
  }
  redirect("/app");
}
