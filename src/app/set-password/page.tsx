import { setPassword } from "./actions";

export default async function SetPassword({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main style={{ maxWidth: 380, margin: "4rem auto", padding: "0 1rem" }}>
      <h1>Define tu contraseña</h1>
      {error && <p role="alert" style={{ color: "#b00020" }}>{error}</p>}
      <form action={setPassword}>
        <label>Nueva contraseña (mínimo 8 caracteres)
          <input name="password" type="password" required minLength={8} autoComplete="new-password"
            style={{ display: "block", width: "100%", margin: "0.25rem 0 1rem", padding: "0.6rem", boxSizing: "border-box" }} />
        </label>
        <button type="submit" style={{ padding: "0.6rem 1.2rem" }}>Guardar y entrar</button>
      </form>
    </main>
  );
}
