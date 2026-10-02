import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "../login/actions";

export default async function AppHome() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberships } = await supabase
    .from("memberships")
    .select("is_admin, fixed_cargo, companies(id, name)")
    .eq("user_id", user.id);

  if (!memberships?.length) redirect("/onboarding");

  return (
    <main style={{ maxWidth: 640, margin: "4rem auto", padding: "0 1rem" }}>
      <h1>Protocolos de Calidad</h1>
      <p>Sesión iniciada como {user.email}</p>
      <ul>
        {memberships.map((m) => {
          const company = m.companies as unknown as { id: string; name: string };
          return (
            <li key={company.id}>
              {company.name}{m.is_admin ? " · administrador" : ""}{m.fixed_cargo ? ` · ${m.fixed_cargo}` : ""}
            </li>
          );
        })}
      </ul>
      <form action={logout}><button type="submit">Cerrar sesión</button></form>
    </main>
  );
}
