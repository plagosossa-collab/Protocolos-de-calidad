"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const msg = (m: string) => encodeURIComponent(m);

export async function login(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  });
  if (error) redirect(`/login?error=${msg("Correo o contraseña incorrectos")}`);
  redirect("/app");
}

export async function signup(formData: FormData) {
  const supabase = await createClient();
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) redirect(`/login?mode=signup&error=${msg("La contraseña debe tener al menos 8 caracteres")}`);
  const { data, error } = await supabase.auth.signUp({
    email: String(formData.get("email") ?? "").trim(),
    password,
    options: { data: { full_name: String(formData.get("full_name") ?? "").trim() } },
  });
  if (error) redirect(`/login?mode=signup&error=${msg(error.message)}`);
  // Con confirmación de correo activada no hay sesión todavía.
  if (!data.session) redirect(`/login?info=${msg("Revisa tu correo para confirmar la cuenta y luego inicia sesión")}`);
  redirect("/app");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
