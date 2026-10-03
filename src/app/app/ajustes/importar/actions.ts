"use server";

import { revalidatePath } from "next/cache";
import { getContext, flash } from "@/lib/context";
import { importLegacyXlsx } from "@/lib/domain/legacy-xlsx";

const BACK = "/app/ajustes/importar";

export async function importLegacy(formData: FormData) {
  const { supabase, company, isAdmin } = await getContext();
  if (!isAdmin) flash(BACK, "error", "Solo un administrador puede importar");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) flash(BACK, "error", "Selecciona el archivo .xlsx exportado de la planilla");

  let cfg: Awaited<ReturnType<typeof importLegacyXlsx>> | null = null;
  let problem = "";
  try { cfg = await importLegacyXlsx(await (file as File).arrayBuffer()); }
  catch (e) { problem = e instanceof Error ? e.message : "No se pudo leer el archivo"; }
  if (!cfg) flash(BACK, "error", problem);
  const c = cfg!;

  const { count } = await supabase.from("projects").select("id", { count: "exact", head: true }).eq("name", c.obra);
  if (count) flash(BACK, "error", `Ya existe una obra llamada «${c.obra}». Elimínala o cámbiale el nombre antes de importar.`);

  const { data: project, error: pErr } = await supabase.from("projects").insert({ company_id: company.id, name: c.obra }).select("id").single();
  if (pErr || !project) flash(BACK, "error", "No se pudo crear la obra");

  // Sin transacción entre llamadas: si algo falla, se borra la obra (cascada) y no queda nada a medias.
  const fail = async (what: string): Promise<never> => {
    await supabase.from("projects").delete().eq("id", project!.id);
    return flash(BACK, "error", `${what}. No se importó nada.`);
  };

  if (c.buildings.length) {
    const { error } = await supabase.from("buildings").insert(
      c.buildings.map((b) => ({ company_id: company.id, project_id: project!.id, name: b.name, floors: b.floors, units_per_floor: b.unitsPerFloor })));
    if (error) await fail("No se pudieron crear los edificios");
  }

  let items = 0;
  for (const p of c.partidas) {
    const { data: row, error } = await supabase.from("partidas")
      .insert({ company_id: company.id, project_id: project!.id, name: p.name, code: p.code || null, title: p.title || null })
      .select("id").single();
    if (error || !row) return fail(`No se pudo crear la partida «${p.name}»`);
    if (p.roles.length) {
      const { error: rErr } = await supabase.rpc("set_partida_roles", { p_partida: row.id, p_roles: p.roles });
      if (rErr) return fail(`No se pudieron guardar los cargos de «${p.name}»`);
    }
    if (p.items.length) {
      const { error: iErr } = await supabase.from("partida_items").insert(p.items.map((it, k) => ({
        company_id: company.id, partida_id: row.id, position: k, code: it.code || null,
        description: it.description, document: it.document || null, team: it.team || null })));
      if (iErr) return fail(`No se pudieron guardar los ítems de «${p.name}»`);
      items += p.items.length;
    }
  }

  revalidatePath("/app/obras");
  flash(`/app/obras/${project!.id}`, "ok",
    `Importado: ${c.buildings.length} edificios, ${c.partidas.length} partidas y ${items} ítems.` +
    (c.recordCount ? ` La planilla trae además ${c.recordCount} registros de checklist, que se migrarán en un paso aparte.` : ""));
}
