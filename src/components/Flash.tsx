export function Flash({ ok, error }: { ok?: string; error?: string }) {
  return (
    <>
      {error && <p role="alert" className="flash flash-error">{error}</p>}
      {ok && <p role="status" className="flash flash-ok">{ok}</p>}
    </>
  );
}
