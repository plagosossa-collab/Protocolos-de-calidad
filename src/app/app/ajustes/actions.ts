"use server";

import { revalidatePath } from "next/cache";
import { getContext, flash } from "@/lib/context";
import { safeBrand } from "@/lib/brand";

const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

export async function saveBranding(formData: FormData) {
  const { supabase, company, isAdmin } = await getContext();
  if (!isAdmin) flash("/app/ajustes", "error", "Solo un administrador puede cambiar los ajustes");

  const update: { brand_color: string; logo_path?: string } = { brand_color: safeBrand(String(formData.get("brand_color") ?? "")) };
  const file = formData.get("logo");
  let oldPath: string | null = null;

  if (file instanceof File && file.size > 0) {
    const ext = EXT[file.type];
    if (!ext) flash("/app/ajustes", "error", "El logo debe ser PNG, JPG o WEBP");
    if (file.size > 2 * 1024 * 1024) flash("/app/ajustes", "error", "El logo no puede pesar más de 2 MB");
    const path = `${company.id}/logo-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("branding").upload(path, file, { contentType: file.type });
    if (error) flash("/app/ajustes", "error", "No se pudo subir el logo");
    oldPath = company.logo_path;
    update.logo_path = path;
  }

  const { error } = await supabase.from("companies").update(update).eq("id", company.id);
  if (error) flash("/app/ajustes", "error", "No se pudieron guardar los cambios");
  if (oldPath) await supabase.storage.from("branding").remove([oldPath]);

  revalidatePath("/app", "layout");
  flash("/app/ajustes", "ok", "Ajustes guardados");
}
