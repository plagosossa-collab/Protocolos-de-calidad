import { createCompany } from "./actions";

export default async function Onboarding({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <div className="auth">
      <div className="auth-card">
        <h1>Crea tu empresa</h1>
        <p className="auth-sub">Serás su primer administrador.</p>
        {error && <p role="alert" className="flash flash-error">{error}</p>}
        <form action={createCompany}>
          <label>Nombre de la empresa<input name="name" required /></label>
          <label>Identificador (minúsculas, números y guiones)
            <input name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="alborada" />
          </label>
          <button type="submit">Crear empresa</button>
        </form>
      </div>
    </div>
  );
}
