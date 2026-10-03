import { notFound } from "next/navigation";
import { getContext } from "@/lib/context";
import { Flash } from "@/components/Flash";
import { CELL_LABEL, cellState, unitLabel, type CellState } from "@/lib/domain/protocol";
import type { ItemStatus } from "@/lib/domain/checklist";
import { openChecklist } from "@/app/app/registro/actions";

export default async function Registros({ params, searchParams }: {
  params: Promise<{ id: string; pid: string }>; searchParams: Promise<{ edificio?: string; ok?: string; error?: string }>;
}) {
  const [{ id, pid }, { edificio, ok, error }] = await Promise.all([params, searchParams]);
  const { supabase, cargo } = await getContext();
  const { data: partida } = await supabase.from("partidas").select("id, name, code, projects(name)").eq("id", pid).eq("project_id", id).maybeSingle();
  if (!partida) notFound();

  const [{ data: buildings }, { data: roles }] = await Promise.all([
    supabase.from("buildings").select("id, name, floors, units_per_floor").eq("project_id", id).order("name"),
    supabase.from("partida_roles").select("cargo").eq("partida_id", pid).order("position"),
  ]);
  const building = buildings?.find((b) => b.id === edificio) ?? buildings?.[0];
  const roleList = (roles ?? []).map((r) => r.cargo);

  const states = new Map<string, CellState>();
  if (building) {
    const { data: rows } = await supabase.from("checklists")
      .select("floor, unit, checklist_items(status), signatures(cargo)").eq("partida_id", pid).eq("building_id", building.id);
    for (const r of rows ?? []) {
      states.set(`${r.floor}-${r.unit}`, cellState(
        (r.checklist_items as unknown as { status: ItemStatus }[]) ?? [], roleList, ((r.signatures as unknown as { cargo: string }[]) ?? []).map((s) => s.cargo)));
    }
  }
  const here = `/app/obras/${id}/partidas/${pid}/registros${building ? `?edificio=${building.id}` : ""}`;
  const projectName = (partida.projects as unknown as { name: string }).name;

  return (
    <>
      <p className="crumbs"><a href="/app/obras">Obras</a> / <a href={`/app/obras/${id}`}>{projectName}</a> / <a href={`/app/obras/${id}/partidas/${pid}`}>{partida.name}</a> / Registros</p>
      <div className="page-head"><h1>{partida.code && <span className="badge" style={{ marginRight: 8, verticalAlign: "middle" }}>{partida.code}</span>}{partida.name}</h1>
        <p className="muted">Toca un depto para abrir o iniciar su protocolo{cargo ? ` · actúas como ${cargo}` : " · sin cargo asignado: solo puedes mirar"}</p></div>
      <Flash ok={ok} error={error} />

      {!roleList.length && <p className="flash flash-error">Esta partida aún no tiene cargos de firma; defínelos antes de usarla.</p>}
      {!buildings?.length ? <p className="empty">La obra no tiene edificios.</p> : (
        <>
          <nav className="tabs">
            {buildings.map((b) => (
              <a key={b.id} href={`/app/obras/${id}/partidas/${pid}/registros?edificio=${b.id}`} className={b.id === building?.id ? "tab on" : "tab"}>{b.name}</a>
            ))}
          </nav>
          <section className="card">
            <div className="legend">
              {(Object.keys(CELL_LABEL) as CellState[]).map((s) => <span key={s}><i className={`dot st-${s}`} /> {CELL_LABEL[s]}</span>)}
            </div>
            <form action={openChecklist}>
              <input type="hidden" name="partida_id" value={pid} />
              <input type="hidden" name="building_id" value={building!.id} />
              <input type="hidden" name="return" value={here} />
              <div className="unit-grid" style={{ gridTemplateColumns: `3rem repeat(${building!.units_per_floor}, minmax(3.2rem, 1fr))` }}>
                {Array.from({ length: building!.floors }, (_, i) => building!.floors - i).map((floor) => (
                  <div key={floor} style={{ display: "contents" }}>
                    <span className="floor">P{floor}</span>
                    {Array.from({ length: building!.units_per_floor }, (_, u) => u + 1).map((unit) => {
                      const state = states.get(`${floor}-${unit}`) ?? "none";
                      return <button key={unit} name="cell" value={`${floor}-${unit}`} className={`cell st-${state}`} title={`${unitLabel(floor, unit)} · ${CELL_LABEL[state]}`}>{unitLabel(floor, unit)}</button>;
                    })}
                  </div>
                ))}
              </div>
            </form>
          </section>
        </>
      )}
    </>
  );
}
