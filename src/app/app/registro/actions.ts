"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { getContext, flash } from "@/lib/context";
import { STATUSES } from "@/lib/domain/protocol";
import type { ItemStatus } from "@/lib/domain/checklist";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const back = (cl: string, hash = "") => redirect(`/app/registro/${cl}${hash}`);

/** Los errores de las funciones SQL llegan con un mensaje pensado para el usuario. */
const msg = (e: { message?: string } | null) => (e?.message ?? "No se pudo completar la acción").replace(/^.*?:\s*/, "");

export async function openChecklist(formData: FormData) {
  const { supabase } = await getContext();
  const [floor, unit] = str(formData, "cell").split("-").map(Number);
  const back_ = str(formData, "return");
  const { data, error } = await supabase.rpc("ensure_checklist", {
    p_partida: str(formData, "partida_id"), p_building: str(formData, "building_id"), p_floor: floor, p_unit: unit,
  });
  if (error || !data) flash(back_, "error", msg(error));
  redirect(`/app/registro/${data}`);
}

export async function setItem(formData: FormData) {
  const { supabase } = await getContext();
  const [cl, item, status] = [str(formData, "checklist_id"), str(formData, "item_id"), str(formData, "status") as ItemStatus];
  if (!STATUSES.includes(status)) flash(`/app/registro/${cl}`, "error", "Estado inválido");
  const { error } = await supabase.rpc("set_item_state", { p_item: item, p_status: status, p_observation: str(formData, "observation") });
  if (error) flash(`/app/registro/${cl}`, "error", msg(error));
  revalidatePath(`/app/registro/${cl}`);
  back(cl, `#i-${item}`);
}

export async function acceptPending(formData: FormData) {
  const { supabase } = await getContext();
  const cl = str(formData, "checklist_id");
  const { data: pending } = await supabase.from("checklist_items").select("id, observation").eq("checklist_id", cl).eq("status", "pending");
  for (const it of pending ?? []) {
    const { error } = await supabase.rpc("set_item_state", { p_item: it.id, p_status: "accepted", p_observation: it.observation });
    if (error) flash(`/app/registro/${cl}`, "error", msg(error));
  }
  revalidatePath(`/app/registro/${cl}`);
  flash(`/app/registro/${cl}`, "ok", `${pending?.length ?? 0} ítems marcados como Aceptado`);
}

export async function setGeneralObservation(formData: FormData) {
  const { supabase } = await getContext();
  const cl = str(formData, "checklist_id");
  const { error } = await supabase.rpc("set_general_observation", { p_checklist: cl, p_text: str(formData, "text") });
  if (error) flash(`/app/registro/${cl}`, "error", msg(error));
  revalidatePath(`/app/registro/${cl}`);
  flash(`/app/registro/${cl}`, "ok", "Observaciones guardadas");
}

export async function addPhoto(formData: FormData) {
  const { supabase, company } = await getContext();
  const [cl, item] = [str(formData, "checklist_id"), str(formData, "item_id")];
  const file = formData.get("photo");
  if (!(file instanceof File) || !file.size) flash(`/app/registro/${cl}`, "error", "No se recibió la foto");
  const f = file as File;
  if (!["image/jpeg", "image/png", "image/webp"].includes(f.type) || f.size > 5 * 1024 * 1024) {
    flash(`/app/registro/${cl}`, "error", "La foto debe ser JPG, PNG o WEBP de hasta 5 MB");
  }
  const path = `${company.id}/${cl}/${randomUUID()}.${f.type === "image/png" ? "png" : f.type === "image/webp" ? "webp" : "jpg"}`;
  const up = await supabase.storage.from("evidence").upload(path, f, { contentType: f.type });
  if (up.error) flash(`/app/registro/${cl}`, "error", "No se pudo subir la foto");
  const { error } = await supabase.rpc("add_photo", { p_item: item, p_path: path });
  if (error) flash(`/app/registro/${cl}`, "error", msg(error));
  revalidatePath(`/app/registro/${cl}`);
  back(cl, `#i-${item}`);
}

export async function signChecklist(formData: FormData) {
  const { supabase, company } = await getContext();
  const cl = str(formData, "checklist_id");
  const url = str(formData, "signature");
  const prefix = "data:image/png;base64,";
  if (!url.startsWith(prefix) || url.length > 600_000) flash(`/app/registro/${cl}`, "error", "Dibuja tu firma antes de firmar");
  const bytes = Buffer.from(url.slice(prefix.length), "base64");
  if (bytes.length < 200) flash(`/app/registro/${cl}`, "error", "Dibuja tu firma antes de firmar");

  const path = `${company.id}/${cl}/firma-${randomUUID()}.png`;
  const up = await supabase.storage.from("evidence").upload(path, bytes, { contentType: "image/png" });
  if (up.error) flash(`/app/registro/${cl}`, "error", "No se pudo guardar la firma");
  const { error } = await supabase.rpc("sign_checklist", { p_checklist: cl, p_file_path: path });
  if (error) flash(`/app/registro/${cl}`, "error", msg(error));
  revalidatePath(`/app/registro/${cl}`);
  flash(`/app/registro/${cl}`, "ok", "Firmado");
}
