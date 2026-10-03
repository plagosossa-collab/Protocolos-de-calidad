import { redirect } from "next/navigation";
import { getContext } from "@/lib/context";
import { Flash } from "@/components/Flash";
import { importLegacy } from "./actions";

export default async function Importar({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const { isAdmin } = await getContext();
  if (!isAdmin) redirect("/app");
  return (
    <>
      <p className="crumbs"><a href="/app/ajustes">Ajustes</a> / Importar</p>
      <div className="page-head"><h1>Importar desde la versión anterior</h1>
        <p className="muted">Crea la obra, los edificios, las partidas, sus cargos de firma y sus ítems a partir de la planilla de Google Sheets.</p></div>
      <Flash error={error} />
      <section className="card">
        <ol>
          <li>En Google Sheets abre la planilla de la app anterior.</li>
          <li>Archivo → Descargar → <strong>Microsoft Excel (.xlsx)</strong>.</li>
          <li>Sube aquí ese archivo.</li>
        </ol>
        <form action={importLegacy}>
          <div className="form-grid">
            <label>Archivo .xlsx<input name="file" type="file" accept=".xlsx" required /></label>
            <button type="submit">Importar</button>
          </div>
        </form>
        <p className="muted" style={{ marginBottom: 0 }}>
          No se copian contraseñas ni usuarios: cada persona se invita de nuevo desde «Usuarios». Los registros de checklist ya llenados no se importan en este paso.
        </p>
      </section>
    </>
  );
}
