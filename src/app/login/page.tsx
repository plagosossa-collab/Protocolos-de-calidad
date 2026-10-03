import { login, signup } from "./actions";

type Props = { searchParams: Promise<{ mode?: string; error?: string; info?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const { mode, error, info } = await searchParams;
  const isSignup = mode === "signup";
  return (
    <div className="auth">
      <div className="auth-card">
        <h1>{isSignup ? "Crear cuenta" : "Protocolos de Calidad"}</h1>
        <p className="auth-sub">{isSignup ? "Registra tu cuenta para crear tu empresa." : "Inicia sesión para continuar."}</p>
        {error && <p role="alert" className="flash flash-error">{error}</p>}
        {info && <p role="status" className="flash flash-ok">{info}</p>}
        <form action={isSignup ? signup : login}>
          {isSignup && <label>Nombre<input name="full_name" required autoComplete="name" /></label>}
          <label>Correo<input name="email" type="email" required autoComplete="email" /></label>
          <label>Contraseña
            <input name="password" type="password" required minLength={isSignup ? 8 : undefined}
              autoComplete={isSignup ? "new-password" : "current-password"} />
          </label>
          <button type="submit">{isSignup ? "Crear cuenta" : "Entrar"}</button>
        </form>
        <p style={{ textAlign: "center", marginBottom: 0 }}>
          {isSignup ? <a href="/login">Ya tengo cuenta</a> : <a href="/login?mode=signup">Crear cuenta</a>}
        </p>
      </div>
    </div>
  );
}
