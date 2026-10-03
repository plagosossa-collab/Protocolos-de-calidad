import type { CSSProperties } from "react";
import { getContext } from "@/lib/context";
import { inkOn } from "@/lib/brand";
import { logout } from "../login/actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { company, logoUrl, brand, isAdmin, user } = await getContext();
  const style = {
    "--brand": brand,
    "--brand-ink": inkOn(brand),
    ...(logoUrl ? { "--logo": `url("${encodeURI(logoUrl)}")` } : {}),
  } as CSSProperties;

  return (
    <div className="shell" style={style}>
      <header className="topbar">
        <div className="topbar-in">
          <a className="brand" href="/app">
            {logoUrl && /* eslint-disable-next-line @next/next/no-img-element */ <img src={logoUrl} alt="" />}
            <span>{company.name}</span>
          </a>
          <nav className="nav">
            <a href="/app">Inicio</a>
            <a href="/app/obras">Obras</a>
            <a href="/app/users">Usuarios</a>
            {isAdmin && <a href="/app/ajustes">Ajustes</a>}
          </nav>
          <div className="who">
            <span>{user.email}</span>
            <form action={logout}><button className="secondary small" type="submit">Salir</button></form>
          </div>
        </div>
      </header>
      <main className="main">{children}</main>
    </div>
  );
}
