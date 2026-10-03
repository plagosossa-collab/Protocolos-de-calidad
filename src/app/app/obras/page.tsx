import { getContext } from "@/lib/context";
import { Flash } from "@/components/Flash";
import { createProject } from "./actions";

export default async function Obras({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { ok, error } = await searchParams;
  const { supabase, isAdmin } = await getContext();
  const { data: projects } = await supabase.from("projects").select("id, name").order("created_at");
  return (
    <>
      <div className="page-head"><h1>Obras</h1><p className="muted">Cada obra tiene sus edificios y partidas</p></div>
      <Flash ok={ok} error={error} />
      {isAdmin && (
        <section className="card">
          <h2>Nueva obra</h2>
          <form action={createProject}>
            <div className="form-grid"><label>Nombre<input name="name" required placeholder="Edificio Los Aromos" /></label><button type="submit">Crear obra</button></div>
          </form>
        </section>
      )}
      {projects?.length ? (
        <div className="grid">
          {projects.map((p) => (<a key={p.id} className="tile" href={`/app/obras/${p.id}`}><strong>{p.name}</strong><span className="muted">Ver edificios y partidas →</span></a>))}
        </div>
      ) : <p className="empty">Aún no hay obras.</p>}
    </>
  );
}
