"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { leavesNoAdmin } from "@/lib/domain/members";

const back = (kind: "ok" | "error", text: string): never =>
  redirect(`/app/users?${kind}=${encodeURIComponent(text)}`);

/** Devuelve el cliente de sesión y el usuario, o corta si no es administrador de la empresa. */
async function requireAdmin(companyId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data } = await supabase
    .from("memberships").select("is_admin")
    .eq("company_id", companyId).eq("user_id", user.id).maybeSingle();
  if (!data?.is_admin) back("error", "Solo un administrador puede gestionar usuarios");
  return { supabase, user };
}

export async function inviteMember(formData: FormData) {
  const companyId = String(formData.get("company_id") ?? "");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const cargo = String(formData.get("fixed_cargo") ?? "").trim() || null;
  const isAdmin = formData.get("is_admin") === "on";
  if (!email || !fullName) back("error", "Nombre y correo son obligatorios");

  const { supabase } = await requireAdmin(companyId);
  const admin = createAdminClient();

  let userId: string | null = (await admin.rpc("user_id_by_email", { p_email: email })).data;
  let invited = false;
  if (!userId) {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { data: { full_name: fullName } });
    if (error || !data?.user) return back("error", `No se pudo enviar la invitación: ${error?.message ?? "error desconocido"}`);
    userId = data.user.id;
    invited = true;
  }

  const { error } = await supabase.from("memberships").insert({
    company_id: companyId, user_id: userId, is_admin: isAdmin, fixed_cargo: cargo, notify_email: email,
  });
  if (error) back("error", error.code === "23505" ? "Esa persona ya pertenece a la empresa" : "No se pudo agregar a la empresa");

  revalidatePath("/app/users");
  back("ok", invited ? `Invitación enviada a ${email}` : `${email} ya tenía cuenta y fue agregado a la empresa`);
}

async function members(supabase: Awaited<ReturnType<typeof createClient>>, companyId: string) {
  const { data } = await supabase.from("memberships").select("user_id, is_admin").eq("company_id", companyId);
  return (data ?? []).map((m) => ({ userId: m.user_id, isAdmin: m.is_admin }));
}

export async function updateMember(formData: FormData) {
  const companyId = String(formData.get("company_id") ?? "");
  const userId = String(formData.get("user_id") ?? "");
  const cargo = String(formData.get("fixed_cargo") ?? "").trim() || null;
  const isAdmin = formData.get("is_admin") === "on";
  const { supabase } = await requireAdmin(companyId);

  if (leavesNoAdmin(await members(supabase, companyId), userId, { isAdmin })) {
    back("error", "La empresa debe tener al menos un administrador");
  }
  const { error } = await supabase.from("memberships")
    .update({ fixed_cargo: cargo, is_admin: isAdmin }).eq("company_id", companyId).eq("user_id", userId);
  if (error) back("error", "No se pudo guardar el cambio");
  revalidatePath("/app/users");
  back("ok", "Cambios guardados");
}

export async function removeMember(formData: FormData) {
  const companyId = String(formData.get("company_id") ?? "");
  const userId = String(formData.get("user_id") ?? "");
  const { supabase } = await requireAdmin(companyId);

  if (leavesNoAdmin(await members(supabase, companyId), userId, { remove: true })) {
    back("error", "No puedes quitar al único administrador");
  }
  const { error } = await supabase.from("memberships").delete().eq("company_id", companyId).eq("user_id", userId);
  if (error) back("error", "No se pudo quitar a la persona");
  revalidatePath("/app/users");
  back("ok", "Persona quitada de la empresa");
}
