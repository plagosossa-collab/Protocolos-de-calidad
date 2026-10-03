import { getContext } from "@/lib/context";

export default async function AppHome() {
  const { supabase, company, isAdmin, cargo } = await getContext();
  const [{ count: obras }, { count: miembros }] = await Promise.all([
    supabase.from("projects").select("id", { count: "exact", head: true }),
    supabase.from("memberships").select("user_id", { count: "exact", head: true }).eq("company_id", company.id),
  ]);
  return (
    <>
      <div className="page-head">
        <h1>Bienvenido</h1>
        <p className="muted">{company.name}{cargo ? ` · ${cargo}` : ""}{isAdmin ? " · administrador" : ""}</p>
      </div>
      <div className="grid">
        <a className="tile" href="/app/obras"><strong>Obras</strong><span className="muted">{obras ?? 0} registradas · edificios y partidas</span></a>
        <a className="tile" href="/app/users"><strong>Usuarios</strong><span className="muted">{miembros ?? 0} personas · cargos y accesos</span></a>
        {isAdmin && <a className="tile" href="/app/ajustes"><strong>Ajustes</strong><span className="muted">Logo y color de la empresa</span></a>}
      </div>
    </>
  );
}
