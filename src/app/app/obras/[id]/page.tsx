import { notFound } from "next/navigation";
import { getContext } from "@/lib/context";
import { Flash } from "@/components/Flash";
import { ConfirmButton } from "@/components/ConfirmButton";
import { addBuilding, addPartida, deleteBuilding, deletePartida, deleteProject } from "../actions";

export default async function Obra({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const [{ id }, { ok, error }] = await Promise.all([params, searchParams]);
  const { supabase, isAdmin } = await getContext();
  const { data: project } = await supabase.from("projects").select("id, name").eq("id", id).maybeSingle();
  if (!project) notFound();
  const [{ data: buildings }, { data: partidas }] = await Promise.all([
    supabase.from("buildings").select("id, name, floors, units_per_floor").eq("project_id", id).order("name"),
    supabase.from("partidas").select("id, name, partida_items(count)").eq("project_id", id).order("name"),
  ]);

  return (
    <>
      <p className="crumbs"><a href="/app/obras">Obras</a> / {project.name}</p>
      <div className="page-head"><h1>{project.name}</h1></div>
      <Flash ok={ok} error={error} />

      <section className="card">
        <h2>Edificios</h2>
        {buildings?.length ? (
          <div className="table-wrap"><table>
            <thead><tr><th>Nombre</th><th>Pisos</th><th>Deptos por piso</th><th>Total deptos</th><th /></tr></thead>
            <tbody>{buildings.map((b) => (
              <tr key={b.id}><td>{b.name}</td><td>{b.floors}</td><td>{b.units_per_floor}</td><td>{b.floors * b.units_per_floor}</td>
                <td>{isAdmin && (
                  <form action={deleteBuilding} className="row-actions">
                    <input type="hidden" name="project_id" value={id} /><input type="hidden" name="id" value={b.id} />
                    <ConfirmButton message={`¿Eliminar el edificio ${b.name}?`} className="danger small">Eliminar</ConfirmButton>
                  </form>)}</td></tr>))}</tbody>
          </table></div>
        ) : <p className="empty">Sin edificios todavía.</p>}
        {isAdmin && (
          <form action={addBuilding} style={{ marginTop: "1rem" }}>
            <input type="hidden" name="project_id" value={id} />
            <div className="form-grid">
              <label>Nombre<input name="name" required placeholder="Torre A" /></label>
              <label>Pisos<input name="floors" type="number" min={1} required /></label>
              <label>Deptos por piso<input name="units_per_floor" type="number" min={1} required /></label>
              <button type="submit">Agregar edificio</button>
            </div>
          </form>
        )}
      </section>

      <section className="card">
        <h2>Partidas (protocolos)</h2>
        {partidas?.length ? (
          <div className="table-wrap"><table>
            <thead><tr><th>Partida</th><th>Ítems</th><th /></tr></thead>
            <tbody>{partidas.map((p) => (
              <tr key={p.id}>
                <td><a href={`/app/obras/${id}/partidas/${p.id}`}>{p.name}</a></td>
                <td><span className="badge">{(p.partida_items as unknown as { count: number }[])[0]?.count ?? 0}</span></td>
                <td><div className="row-actions">
                  <a className="btn small secondary" style={{ color: "var(--ink)", background: "#fff", border: "1px solid #d0d5dd" }} href={`/app/obras/${id}/partidas/${p.id}`}>{isAdmin ? "Editar" : "Ver"}</a>
                  {isAdmin && (
                    <form action={deletePartida}>
                      <input type="hidden" name="project_id" value={id} /><input type="hidden" name="id" value={p.id} />
                      <ConfirmButton message={`¿Eliminar la partida ${p.name}?`} className="danger small">Eliminar</ConfirmButton>
                    </form>)}
                </div></td></tr>))}</tbody>
          </table></div>
        ) : <p className="empty">Sin partidas todavía.</p>}
        {isAdmin && (
          <form action={addPartida} style={{ marginTop: "1rem" }}>
            <input type="hidden" name="project_id" value={id} />
            <div className="form-grid"><label>Nueva partida<input name="name" required placeholder="Tabiquería" /></label><button type="submit">Crear partida</button></div>
          </form>
        )}
      </section>

      {isAdmin && (
        <form action={deleteProject}>
          <input type="hidden" name="id" value={id} />
          <ConfirmButton message={`¿Eliminar la obra ${project.name} con todos sus edificios y partidas?`} className="danger small">Eliminar obra</ConfirmButton>
        </form>
      )}
    </>
  );
}
