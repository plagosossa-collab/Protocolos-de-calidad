import { notFound } from "next/navigation";
import { getContext } from "@/lib/context";
import { Flash } from "@/components/Flash";
import { ConfirmButton } from "@/components/ConfirmButton";
import { addItem, deleteItem, editRoles, importItems } from "../../../actions";

const COMMON = ["Supervisor Subcontrato", "Supervisor", "Jefe de Terreno", "Control de Calidad", "ITO"];

export default async function PartidaPage({ params, searchParams }: { params: Promise<{ id: string; pid: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const [{ id, pid }, { ok, error }] = await Promise.all([params, searchParams]);
  const { supabase, isAdmin } = await getContext();
  const { data: partida } = await supabase.from("partidas").select("id, name, code, title, project_id, projects(name)").eq("id", pid).eq("project_id", id).maybeSingle();
  if (!partida) notFound();
  const [{ data: roles }, { data: items }] = await Promise.all([
    supabase.from("partida_roles").select("cargo, cc_on_notice").eq("partida_id", pid).order("position"),
    supabase.from("partida_items").select("id, description, document, team").eq("partida_id", pid).order("position"),
  ]);
  const projectName = (partida.projects as unknown as { name: string }).name;
  const hidden = (<><input type="hidden" name="project_id" value={id} /><input type="hidden" name="partida_id" value={pid} /></>);

  return (
    <>
      <p className="crumbs"><a href="/app/obras">Obras</a> / <a href={`/app/obras/${id}`}>{projectName}</a> / {partida.name}</p>
      <div className="page-head"><h1>{partida.code && <span className="badge" style={{ marginRight: 8, verticalAlign: "middle" }}>{partida.code}</span>}{partida.name}</h1>{partida.title && <p className="muted">{partida.title}</p>}</div>
      <Flash ok={ok} error={error} />
      <p><a className="btn" href={`/app/obras/${id}/partidas/${pid}/registros`}>Abrir protocolo en terreno</a></p>

      <section className="card">
        <h2>Cargos de firma, en orden de revisión</h2>
        <p className="muted">El último cargo recibe el aviso cuando los anteriores firman. «En copia» marca quién va en CC de ese aviso.</p>
        {roles?.length ? (
          <ol style={{ paddingLeft: "1.25rem" }}>
            {roles.map((r, k) => (
              <li key={r.cargo} style={{ margin: "0.4rem 0" }}>
                <form action={editRoles} style={{ display: "flex", gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
                  {hidden}<input type="hidden" name="cargo" value={r.cargo} />
                  <strong style={{ minWidth: 180 }}>{r.cargo}</strong>
                  {r.cc_on_notice && <span className="badge">en copia</span>}
                  {k === (roles.length - 1) && roles.length > 1 && <span className="badge">recibe el aviso</span>}
                  {isAdmin && (<>
                    <button name="op" value="up" className="secondary small" disabled={k === 0} aria-label="Subir">↑</button>
                    <button name="op" value="down" className="secondary small" disabled={k === roles.length - 1} aria-label="Bajar">↓</button>
                    <button name="op" value="cc" className="secondary small">{r.cc_on_notice ? "Quitar copia" : "En copia"}</button>
                    <button name="op" value="remove" className="danger small">Quitar</button>
                  </>)}
                </form>
              </li>))}
          </ol>
        ) : <p className="empty">Sin cargos todavía.</p>}
        {isAdmin && (
          <form action={editRoles}>
            {hidden}<input type="hidden" name="op" value="add" />
            <div className="form-grid">
              <label>Agregar cargo<input name="cargo" list="cargos" required placeholder="Jefe de Terreno" /></label>
              <datalist id="cargos">{COMMON.map((c) => <option key={c} value={c} />)}</datalist>
              <button type="submit">Agregar al final</button>
            </div>
          </form>
        )}
      </section>

      <section className="card">
        <h2>Ítems de control ({items?.length ?? 0})</h2>
        {items?.length ? (
          <div className="table-wrap"><table>
            <thead><tr><th>#</th><th>Partida a controlar</th><th>Documento</th><th>Equipo</th><th /></tr></thead>
            <tbody>{items.map((it, k) => (
              <tr key={it.id}><td>{k + 1}</td><td>{it.description}</td><td>{it.document}</td><td>{it.team}</td>
                <td>{isAdmin && (
                  <form action={deleteItem} className="row-actions">{hidden}<input type="hidden" name="id" value={it.id} />
                    <ConfirmButton message="¿Eliminar este ítem?" className="danger small">Eliminar</ConfirmButton></form>)}</td></tr>))}</tbody>
          </table></div>
        ) : <p className="empty">Sin ítems todavía.</p>}
      </section>

      {isAdmin && (
        <>
          <section className="card">
            <h2>Agregar ítem</h2>
            <form action={addItem}>{hidden}
              <div className="form-grid">
                <label>Partida a controlar<input name="description" required /></label>
                <label>Documento<input name="document" /></label>
                <label>Equipo<input name="team" /></label>
                <button type="submit">Agregar</button>
              </div>
            </form>
          </section>
          <section className="card">
            <h2>Importar desde Excel</h2>
            <p className="muted">Se detectan las columnas «Partidas a controlar», «Documento» y «Equipo» sin importar en qué posición estén.</p>
            <form action={importItems}>{hidden}
              <div className="form-grid">
                <label>Archivo .xlsx<input name="file" type="file" accept=".xlsx" required /></label>
                <label>Modo
                  <select name="mode"><option value="append">Agregar a los existentes</option><option value="replace">Reemplazar la lista</option></select>
                </label>
                <button type="submit">Importar</button>
              </div>
            </form>
          </section>
        </>
      )}
    </>
  );
}
