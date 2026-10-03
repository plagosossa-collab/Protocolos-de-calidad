import { redirect } from "next/navigation";
import { getContext } from "@/lib/context";
import { Flash } from "@/components/Flash";
import { saveBranding } from "./actions";

export default async function Ajustes({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { ok, error } = await searchParams;
  const { company, isAdmin, logoUrl, brand } = await getContext();
  if (!isAdmin) redirect("/app");
  return (
    <>
      <div className="page-head"><h1>Ajustes</h1><p className="muted">Imagen de {company.name}</p></div>
      <Flash ok={ok} error={error} />
      <section className="card">
        <h2>Logo y color</h2>
        <form action={saveBranding}>
          <div className="form-grid">
            <label>Logo (PNG, JPG o WEBP, máx. 2 MB)<input name="logo" type="file" accept="image/png,image/jpeg,image/webp" /></label>
            <label>Color principal<input name="brand_color" type="color" defaultValue={brand} /></label>
            <button type="submit">Guardar</button>
          </div>
        </form>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {logoUrl && <p><img src={logoUrl} alt="Logo actual" style={{ maxHeight: 80, maxWidth: 240 }} /></p>}
        <small>El logo aparece en la barra superior y como marca de agua tenue al fondo de la app.</small>
      </section>
    </>
  );
}
