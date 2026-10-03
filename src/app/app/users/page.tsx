import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { inviteMember, removeMember, updateMember } from "./actions";

const field = { display: "block", width: "100%", padding: "0.5rem", boxSizing: "border-box" } as const;

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string; link?: string }> }) {
  const { ok, error, link } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: mine } = await supabase
    .from("memberships").select("company_id, is_admin, companies(name)").eq("user_id", user.id);
  if (!mine?.length) redirect("/onboarding");
  const current = mine.find((m) => m.is_admin) ?? mine[0];
  const companyId = current.company_id;
  const companyName = (current.companies as unknown as { name: string }).name;
  const isAdmin = current.is_admin;

  const { data: rows } = await supabase
    .from("memberships")
    .select("user_id, is_admin, fixed_cargo, notify_email, profiles(full_name)")
    .eq("company_id", companyId)
    .order("created_at");

  return (
    <main style={{ maxWidth: 820, margin: "3rem auto", padding: "0 1rem" }}>
      <p><a href="/app">← Volver</a></p>
      <h1>Usuarios de {companyName}</h1>
      {error && <p role="alert" style={{ color: "#b00020" }}>{error}</p>}
      {ok && <p role="status" style={{ color: "#1a6b2f" }}>{ok}</p>}
      {link && (
        <section style={{ background: "#f3f8f4", border: "1px solid #b7d9bf", padding: "1rem", borderRadius: 8 }}>
          <strong>Envía este enlace a la persona (WhatsApp, correo, etc.):</strong>
          <textarea readOnly rows={3} value={link} style={{ ...field, marginTop: "0.5rem" }} />
          <small>Sirve una sola vez y expira en poco tiempo. Al abrirlo, la persona define su contraseña y entra.</small>
        </section>
      )}

      {isAdmin && (
        <section>
          <h2>Invitar persona</h2>
          <form action={inviteMember} style={{ display: "grid", gap: "0.75rem", maxWidth: 420 }}>
            <input type="hidden" name="company_id" value={companyId} />
            <label>Nombre<input name="full_name" required style={field} /></label>
            <label>Correo<input name="email" type="email" required style={field} /></label>
            <label>Cargo fijo (opcional)<input name="fixed_cargo" placeholder="Jefe de Terreno" style={field} /></label>
            <label><input name="is_admin" type="checkbox" /> Administrador</label>
            <button type="submit" style={{ padding: "0.6rem 1.2rem", justifySelf: "start" }}>Crear invitación</button>
          </form>
        </section>
      )}

      <h2>Miembros</h2>
      {(rows ?? []).map((m) => {
        const profile = m.profiles as unknown as { full_name: string } | null;
        return (
          <form key={m.user_id} action={updateMember}
            style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap", padding: "0.75rem 0", borderTop: "1px solid #ddd" }}>
            <input type="hidden" name="company_id" value={companyId} />
            <input type="hidden" name="user_id" value={m.user_id} />
            <div style={{ flex: "1 1 200px" }}>
              <strong>{profile?.full_name ?? "—"}</strong><br />
              <small>{m.notify_email ?? ""}</small>
            </div>
            {isAdmin ? (
              <>
                <input name="fixed_cargo" defaultValue={m.fixed_cargo ?? ""} placeholder="Cargo" style={{ padding: "0.4rem" }} />
                <label><input name="is_admin" type="checkbox" defaultChecked={m.is_admin} /> Admin</label>
                <button type="submit">Guardar</button>
                <button type="submit" formAction={removeMember}>Quitar</button>
              </>
            ) : (
              <span>{[m.fixed_cargo, m.is_admin ? "administrador" : null].filter(Boolean).join(" · ")}</span>
            )}
          </form>
        );
      })}
    </main>
  );
}
