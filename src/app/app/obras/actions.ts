"use server";

import { revalidatePath } from "next/cache";
import { getContext, flash } from "@/lib/context";
import { importChecklistXlsx } from "@/lib/domain/importer-xlsx";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const int = (f: FormData, k: string) => Number.parseInt(str(f, k), 10);

async function admin() {
  const ctx = await getContext();
  return ctx;
}

export async function createProject(formData: FormData) {
  const { supabase, company, isAdmin } = await admin();
  const name = str(formData, "name");
  if (!isAdmin || !name) flash("/app/obras", "error", "Solo un administrador puede crear obras (y el nombre es obligatorio)");
  const { data, error } = await supabase.from("projects").insert({ company_id: company.id, name }).select("id").single();
  if (error || !data) flash("/app/obras", "error", "No se pudo crear la obra");
  revalidatePath("/app/obras");
  flash(`/app/obras/${data!.id}`, "ok", "Obra creada");
}

export async function addBuilding(formData: FormData) {
  const { supabase, company } = await admin();
  const pid = str(formData, "project_id");
  const path = `/app/obras/${pid}`;
  const [name, floors, units] = [str(formData, "name"), int(formData, "floors"), int(formData, "units_per_floor")];
  if (!name || !(floors > 0) || !(units > 0)) flash(path, "error", "Indica nombre, pisos y deptos por piso (números mayores a 0)");
  const { error } = await supabase.from("buildings").insert({ company_id: company.id, project_id: pid, name, floors, units_per_floor: units });
  if (error) flash(path, "error", "No se pudo agregar el edificio");
  revalidatePath(path);
  flash(path, "ok", "Edificio agregado");
}

export async function deleteBuilding(formData: FormData) {
  const { supabase } = await admin();
  const [pid, id] = [str(formData, "project_id"), str(formData, "id")];
  const path = `/app/obras/${pid}`;
  const { count } = await supabase.from("checklists").select("id", { count: "exact", head: true }).eq("building_id", id);
  if (count) flash(path, "error", "El edificio tiene registros de protocolos y no se puede eliminar");
  const { error } = await supabase.from("buildings").delete().eq("id", id);
  if (error) flash(path, "error", "No se pudo eliminar el edificio");
  revalidatePath(path);
  flash(path, "ok", "Edificio eliminado");
}

export async function addPartida(formData: FormData) {
  const { supabase, company } = await admin();
  const pid = str(formData, "project_id");
  const path = `/app/obras/${pid}`;
  const name = str(formData, "name");
  if (!name) flash(path, "error", "El nombre de la partida es obligatorio");
  const { data, error } = await supabase.from("partidas")
    .insert({ company_id: company.id, project_id: pid, name, code: str(formData, "code") || null, title: str(formData, "title") || null })
    .select("id").single();
  if (error || !data) flash(path, "error", "No se pudo crear la partida");
  revalidatePath(path);
  flash(`${path}/partidas/${data!.id}`, "ok", "Partida creada. Define ahora sus cargos de firma e ítems.");
}

export async function deletePartida(formData: FormData) {
  const { supabase } = await admin();
  const [pid, id] = [str(formData, "project_id"), str(formData, "id")];
  const path = `/app/obras/${pid}`;
  const { count } = await supabase.from("checklists").select("id", { count: "exact", head: true }).eq("partida_id", id);
  if (count) flash(path, "error", "La partida tiene registros y no se puede eliminar");
  const { error } = await supabase.from("partidas").delete().eq("id", id);
  if (error) flash(path, "error", "No se pudo eliminar la partida");
  revalidatePath(path);
  flash(path, "ok", "Partida eliminada");
}

export async function deleteProject(formData: FormData) {
  const { supabase } = await admin();
  const id = str(formData, "id");
  const { data: partidas } = await supabase.from("partidas").select("id").eq("project_id", id);
  const ids = (partidas ?? []).map((p) => p.id);
  if (ids.length) {
    const { count } = await supabase.from("checklists").select("id", { count: "exact", head: true }).in("partida_id", ids);
    if (count) flash("/app/obras", "error", "La obra tiene registros de protocolos y no se puede eliminar");
  }
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) flash("/app/obras", "error", "No se pudo eliminar la obra");
  revalidatePath("/app/obras");
  flash("/app/obras", "ok", "Obra eliminada");
}

// ───────── Partida: cargos de firma ─────────

type Role = { cargo: string; cc: boolean };

export async function editRoles(formData: FormData) {
  const { supabase } = await admin();
  const [pid, partida] = [str(formData, "project_id"), str(formData, "partida_id")];
  const path = `/app/obras/${pid}/partidas/${partida}`;
  const op = str(formData, "op");
  const cargo = str(formData, "cargo");

  const { data } = await supabase.from("partida_roles").select("cargo, cc_on_notice").eq("partida_id", partida).order("position");
  const roles: Role[] = (data ?? []).map((r) => ({ cargo: r.cargo, cc: r.cc_on_notice }));
  const i = roles.findIndex((r) => r.cargo === cargo);

  if (op === "add") {
    if (!cargo) flash(path, "error", "Escribe el nombre del cargo");
    if (i >= 0) flash(path, "error", "Ese cargo ya está en la lista");
    roles.push({ cargo, cc: false });
  } else if (i >= 0) {
    if (op === "remove") roles.splice(i, 1);
    if (op === "cc") roles[i].cc = !roles[i].cc;
    if (op === "up" && i > 0) [roles[i - 1], roles[i]] = [roles[i], roles[i - 1]];
    if (op === "down" && i < roles.length - 1) [roles[i + 1], roles[i]] = [roles[i], roles[i + 1]];
  }
  const { error } = await supabase.rpc("set_partida_roles", { p_partida: partida, p_roles: roles });
  if (error) flash(path, "error", "No se pudieron guardar los cargos");
  revalidatePath(path);
  flash(path, "ok", "Cargos actualizados");
}

// ───────── Partida: ítems de control ─────────

export async function addItem(formData: FormData) {
  const { supabase, company } = await admin();
  const [pid, partida] = [str(formData, "project_id"), str(formData, "partida_id")];
  const path = `/app/obras/${pid}/partidas/${partida}`;
  const description = str(formData, "description");
  if (!description) flash(path, "error", "La descripción del ítem es obligatoria");
  const { data: last } = await supabase.from("partida_items").select("position").eq("partida_id", partida).order("position", { ascending: false }).limit(1);
  const position = (last?.[0]?.position ?? -1) + 1;
  const { error } = await supabase.from("partida_items").insert({
    company_id: company.id, partida_id: partida, position, description,
    document: str(formData, "document") || null, team: str(formData, "team") || null,
  });
  if (error) flash(path, "error", "No se pudo agregar el ítem");
  revalidatePath(path);
  flash(path, "ok", "Ítem agregado");
}

export async function deleteItem(formData: FormData) {
  const { supabase } = await admin();
  const [pid, partida, id] = [str(formData, "project_id"), str(formData, "partida_id"), str(formData, "id")];
  const path = `/app/obras/${pid}/partidas/${partida}`;
  const { count } = await supabase.from("checklist_items").select("id", { count: "exact", head: true }).eq("partida_item_id", id);
  if (count) flash(path, "error", "El ítem ya se usa en registros y no se puede eliminar");
  const { error } = await supabase.from("partida_items").delete().eq("id", id);
  if (error) flash(path, "error", "No se pudo eliminar el ítem");
  revalidatePath(path);
  flash(path, "ok", "Ítem eliminado");
}

export async function importItems(formData: FormData) {
  const { supabase, company } = await admin();
  const [pid, partida] = [str(formData, "project_id"), str(formData, "partida_id")];
  const path = `/app/obras/${pid}/partidas/${partida}`;
  const file = formData.get("file");
  const replace = str(formData, "mode") === "replace";
  if (!(file instanceof File) || file.size === 0) flash(path, "error", "Selecciona un archivo .xlsx");

  let items: Awaited<ReturnType<typeof importChecklistXlsx>> = [];
  let problem = "";
  try {
    items = await importChecklistXlsx(await (file as File).arrayBuffer());
  } catch (e) {
    problem = e instanceof Error ? e.message : "No se pudo leer el archivo";
  }
  if (problem) flash(path, "error", problem);
  if (!items.length) flash(path, "error", "No se encontraron ítems en la planilla");

  let start = 0;
  if (replace) {
    const { count } = await supabase.from("checklists").select("id", { count: "exact", head: true }).eq("partida_id", partida);
    if (count) flash(path, "error", "La partida ya tiene registros: no se puede reemplazar su lista, solo agregar ítems");
    await supabase.from("partida_items").delete().eq("partida_id", partida);
  } else {
    const { data: last } = await supabase.from("partida_items").select("position").eq("partida_id", partida).order("position", { ascending: false }).limit(1);
    start = (last?.[0]?.position ?? -1) + 1;
  }
  const { error } = await supabase.from("partida_items").insert(
    items.map((it, k) => ({ company_id: company.id, partida_id: partida, position: start + k, description: it.description, document: it.document || null, team: it.team || null })),
  );
  if (error) flash(path, "error", "No se pudieron importar los ítems");
  revalidatePath(path);
  flash(path, "ok", `${items.length} ítems importados`);
}
