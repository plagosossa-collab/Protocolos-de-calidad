import { setPassword } from "./actions";

export default async function SetPassword({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <div className="auth">
      <div className="auth-card">
        <h1>Define tu contraseña</h1>
        <p className="auth-sub">Con ella ingresarás a la app.</p>
        {error && <p role="alert" className="flash flash-error">{error}</p>}
        <form action={setPassword}>
          <label>Nueva contraseña (mínimo 8 caracteres)
            <input name="password" type="password" required minLength={8} autoComplete="new-password" />
          </label>
          <button type="submit">Guardar y entrar</button>
        </form>
      </div>
    </div>
  );
}
