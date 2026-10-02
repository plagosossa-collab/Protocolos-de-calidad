import { login, signup } from "./actions";

type Props = { searchParams: Promise<{ mode?: string; error?: string; info?: string }> };

const input = { display: "block", width: "100%", padding: "0.6rem", margin: "0.25rem 0 1rem", boxSizing: "border-box" } as const;

export default async function LoginPage({ searchParams }: Props) {
  const { mode, error, info } = await searchParams;
  const isSignup = mode === "signup";
  return (
    <main style={{ maxWidth: 380, margin: "4rem auto", padding: "0 1rem" }}>
      <h1>{isSignup ? "Crear cuenta" : "Iniciar sesión"}</h1>
      {error && <p role="alert" style={{ color: "#b00020" }}>{error}</p>}
      {info && <p role="status" style={{ color: "#1a6b2f" }}>{info}</p>}
      <form action={isSignup ? signup : login}>
        {isSignup && (
          <label>Nombre<input name="full_name" required autoComplete="name" style={input} /></label>
        )}
        <label>Correo<input name="email" type="email" required autoComplete="email" style={input} /></label>
        <label>Contraseña
          <input name="password" type="password" required minLength={isSignup ? 8 : undefined}
            autoComplete={isSignup ? "new-password" : "current-password"} style={input} />
        </label>
        <button type="submit" style={{ padding: "0.6rem 1.2rem" }}>{isSignup ? "Crear cuenta" : "Entrar"}</button>
      </form>
      <p>
        {isSignup ? <a href="/login">Ya tengo cuenta</a> : <a href="/login?mode=signup">Crear cuenta</a>}
      </p>
    </main>
  );
}
