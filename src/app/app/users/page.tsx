import { getContext } from "@/lib/context";
import { Flash } from "@/components/Flash";
import { ConfirmButton } from "@/components/ConfirmButton";
import { inviteMember, removeMember, updateMember } from "./actions";

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string; link?: string }> }) {
  const { ok, error, link } = await searchParams;
  const { supabase, company, isAdmin } = await getContext();

  const { data: rows } = await supabase
    .from("memberships")
    .select("user_id, is_admin, fixed_cargo, notify_email, profiles(full_name)")
    .eq("company_id", company.id)
    .order("created_at");

  return (
    <>
      <div className="page-head"><h1>Usuarios</h1><p className="muted">Personas con acceso a {company.name}</p></div>
      <Flash ok={ok} error={error} />

      {link && (
        <section className="card">
          <strong>Envía este enlace a la persona (WhatsApp, correo, etc.):</strong>
          <textarea readOnly rows={3} value={link} />
          <small>Sirve una sola vez y expira en poco tiempo. Al abrirlo, la persona define su contraseña y entra.</small>
        </section>
      )}

      {isAdmin && (
        <section className="card">
          <h2>Invitar persona</h2>
          <form action={inviteMember}>
            <input type="hidden" name="company_id" value={company.id} />
            <div className="form-grid">
              <label>Nombre<input name="full_name" required /></label>
              <label>Correo<input name="email" type="email" required /></label>
              <label>Cargo fijo (opcional)<input name="fixed_cargo" placeholder="Jefe de Terreno" /></label>
              <label className="check"><input name="is_admin" type="checkbox" /> Administrador</label>
              <button type="submit">Crear invitación</button>
            </div>
          </form>
        </section>
      )}

      <section className="card">
        <h2>Miembros</h2>
        {(rows ?? []).map((m) => {
          const profile = m.profiles as unknown as { full_name: string } | null;
          return (
            <form key={m.user_id} action={updateMember} style={{ padding: "0.7rem 0", borderTop: "1px solid var(--line)" }}>
              <input type="hidden" name="company_id" value={company.id} />
              <input type="hidden" name="user_id" value={m.user_id} />
              <div className="form-grid">
                <div><strong>{profile?.full_name ?? "—"}</strong><br /><small>{m.notify_email ?? ""}</small></div>
                {isAdmin ? (
                  <>
                    <label>Cargo<input name="fixed_cargo" defaultValue={m.fixed_cargo ?? ""} /></label>
                    <label className="check"><input name="is_admin" type="checkbox" defaultChecked={m.is_admin} /> Administrador</label>
                    <div className="row-actions">
                      <button type="submit" className="small">Guardar</button>
                      <ConfirmButton message="¿Quitar a esta persona de la empresa?" type="submit" formAction={removeMember} className="danger small">Quitar</ConfirmButton>
                    </div>
                  </>
                ) : (
                  <span>{[m.fixed_cargo, m.is_admin ? "administrador" : null].filter(Boolean).join(" · ")}</span>
                )}
              </div>
            </form>
          );
        })}
      </section>
    </>
  );
}
