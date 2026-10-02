import { createCompany } from "./actions";

export default async function Onboarding({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main style={{ maxWidth: 380, margin: "4rem auto", padding: "0 1rem" }}>
      <h1>Crea tu empresa</h1>
      {error && <p role="alert" style={{ color: "#b00020" }}>{error}</p>}
      <form action={createCompany}>
        <label>Nombre de la empresa<input name="name" required style={{ display: "block", width: "100%", margin: "0.25rem 0 1rem", padding: "0.6rem", boxSizing: "border-box" }} /></label>
        <label>Identificador (minúsculas, números y guiones)
          <input name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="alborada" style={{ display: "block", width: "100%", margin: "0.25rem 0 1rem", padding: "0.6rem", boxSizing: "border-box" }} />
        </label>
        <button type="submit" style={{ padding: "0.6rem 1.2rem" }}>Crear</button>
      </form>
    </main>
  );
}
