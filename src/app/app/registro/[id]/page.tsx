import { notFound } from "next/navigation";
import { getContext } from "@/lib/context";
import { Flash } from "@/components/Flash";
import { PhotoInput } from "@/components/PhotoInput";
import { SignaturePad } from "@/components/SignaturePad";
import { CELL_LABEL, STATUSES, STATUS_LABEL, cargoKey, cellState, nextSigner, unitLabel } from "@/lib/domain/protocol";
import type { ItemStatus } from "@/lib/domain/checklist";
import { acceptPending, addPhoto, setGeneralObservation, setItem, signChecklist } from "../actions";

const fmt = (iso: string) => new Date(iso).toLocaleString("es-CL", { timeZone: "America/Santiago", dateStyle: "short", timeStyle: "short" });
type Row<T> = T & { profiles: { full_name: string } | null };

export default async function Registro({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const [{ id }, { ok, error }] = await Promise.all([params, searchParams]);
  const { supabase, cargo } = await getContext();

  const { data: cl } = await supabase.from("checklists")
    .select("id, floor, unit, general_observation, partida_id, buildings(name), partidas(id, name, code, title, project_id, projects(name))").eq("id", id).maybeSingle();
  if (!cl) notFound();
  const partida = cl.partidas as unknown as { id: string; name: string; code: string | null; title: string | null; project_id: string; projects: { name: string } };

  const [{ data: roles }, { data: rawItems }, { data: sigs }] = await Promise.all([
    supabase.from("partida_roles").select("cargo, position").eq("partida_id", partida.id).order("position"),
    supabase.from("checklist_items").select("id, status, observation, partida_items(position, code, description, document, team)").eq("checklist_id", id),
    supabase.from("signatures").select("cargo, signed_at, file_path, profiles(full_name)").eq("checklist_id", id),
  ]);
  type Item = { id: string; status: ItemStatus; observation: string; partida_items: { position: number; code: string | null; description: string; document: string | null; team: string | null } };
  const items = ((rawItems ?? []) as unknown as Item[]).sort((a, b) => a.partida_items.position - b.partida_items.position);
  const ids = items.map((i) => i.id);

  const [{ data: events }, { data: photos }] = await Promise.all([
    ids.length ? supabase.from("item_events").select("checklist_item_id, cargo, status, observation, created_at, profiles(full_name)").in("checklist_item_id", ids).order("created_at") : { data: [] },
    ids.length ? supabase.from("photos").select("checklist_item_id, file_path").in("checklist_item_id", ids).order("created_at") : { data: [] },
  ]);
  const signedUrls = new Map<string, string>();
  const paths = [...(photos ?? []).map((p) => p.file_path), ...(sigs ?? []).map((s) => s.file_path)];
  if (paths.length) {
    const { data } = await supabase.storage.from("evidence").createSignedUrls(paths, 3600);
    data?.forEach((d) => d.path && d.signedUrl && signedUrls.set(d.path, d.signedUrl));
  }

  const roleList = (roles ?? []).map((r) => r.cargo);
  const signed = (sigs ?? []).map((s) => s.cargo);
  const state = cellState(items, roleList, signed);
  const closed = state === "closed";
  const mine = cargo ? roleList.find((r) => cargoKey(r) === cargoKey(cargo)) : undefined;
  const canEdit = !!mine && !closed;
  const next = nextSigner(roleList, signed);
  const canSign = canEdit && !!next && cargoKey(next) === cargoKey(mine!);
  const here = `/app/obras/${partida.project_id}/partidas/${partida.id}/registros`;
  const pending = items.filter((i) => i.status === "pending").length;

  return (
    <>
      <p className="crumbs"><a href="/app/obras">Obras</a> / <a href={`/app/obras/${partida.project_id}`}>{partida.projects.name}</a> / <a href={here}>{partida.name}</a> / Depto {unitLabel(cl.floor, cl.unit)}</p>
      <div className="page-head">
        <h1>{partida.code && <span className="badge" style={{ marginRight: 8, verticalAlign: "middle" }}>{partida.code}</span>}{partida.title ?? partida.name}</h1>
        <p className="muted">{(cl.buildings as unknown as { name: string }).name} · Depto {unitLabel(cl.floor, cl.unit)} · <span className={`pill st-${state}`}>{CELL_LABEL[state]}</span></p>
      </div>
      <Flash ok={ok} error={error} />
      {!mine && <p className="flash flash-error">{cargo ? `Tu cargo (${cargo}) no participa en esta partida: solo puedes mirar.` : "Tu usuario no tiene un cargo asignado: solo puedes mirar. Un administrador puede asignártelo en Usuarios."}</p>}
      {closed && <p className="flash flash-ok">Protocolo cerrado: lo firmó el último cargo. Ya no admite cambios.</p>}

      <section className="card">
        <h2>Firmas</h2>
        <ol className="signers">
          {roleList.map((r) => {
            const s = (sigs ?? []).find((x) => cargoKey(x.cargo) === cargoKey(r));
            const who = (s?.profiles as unknown as { full_name: string } | null)?.full_name;
            return (
              <li key={r} className={s ? "done" : cargoKey(r) === cargoKey(next ?? "") ? "turn" : ""}>
                <strong>{r}</strong>
                {s ? <span> — {who} · {fmt(s.signed_at)}{signedUrls.get(s.file_path) && <>{" "}{/* eslint-disable-next-line @next/next/no-img-element */}<img className="sig-img" src={signedUrls.get(s.file_path)} alt={`Firma de ${who}`} /></>}</span>
                  : cargoKey(r) === cargoKey(next ?? "") ? <span className="muted"> — le toca firmar</span> : <span className="muted"> — pendiente</span>}
              </li>
            );
          })}
        </ol>
      </section>

      {canEdit && pending > 0 && (
        <form action={acceptPending} style={{ marginBottom: "1rem" }}>
          <input type="hidden" name="checklist_id" value={id} />
          <button type="submit" className="secondary">Marcar los {pending} pendientes como Aceptado</button>
        </form>
      )}

      {items.map((it, k) => {
        const evs = ((events ?? []) as unknown as Row<{ checklist_item_id: string; cargo: string; status: ItemStatus; observation: string; created_at: string }>[]).filter((e) => e.checklist_item_id === it.id);
        const pics = (photos ?? []).filter((p) => p.checklist_item_id === it.id);
        return (
          <article key={it.id} id={`i-${it.id}`} className="card item">
            <form action={setItem}>
              <input type="hidden" name="checklist_id" value={id} />
              <input type="hidden" name="item_id" value={it.id} />
              <div className="item-head">
                <strong>{k + 1}. {it.partida_items.description}</strong>
                <small className="muted">{[it.partida_items.document, it.partida_items.team].filter(Boolean).join(" · ")}</small>
              </div>
              <div className="seg" role="group" aria-label="Estado">
                {STATUSES.map((s) => (
                  <button key={s} name="status" value={s} disabled={!canEdit} className={`seg-btn st-${s}${it.status === s ? " on" : ""}`}>{STATUS_LABEL[s]}</button>
                ))}
              </div>
              <textarea name="observation" rows={1} defaultValue={it.observation} placeholder="Observación (opcional)" disabled={!canEdit} />
              {canEdit && <button name="status" value={it.status} className="secondary small">Guardar observación</button>}
            </form>

            {pics.length > 0 && (
              <div className="thumbs">
                {pics.map((p) => signedUrls.get(p.file_path) && (
                  <a key={p.file_path} href={signedUrls.get(p.file_path)} target="_blank" rel="noreferrer">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={signedUrls.get(p.file_path)} alt="Foto del ítem" /></a>
                ))}
              </div>
            )}
            {canEdit && (
              <form action={addPhoto} style={{ marginTop: "0.5rem" }}>
                <input type="hidden" name="checklist_id" value={id} />
                <input type="hidden" name="item_id" value={it.id} />
                <PhotoInput name="photo" />
              </form>
            )}
            {evs.length > 0 && (
              <details className="history">
                <summary>Historial ({evs.length})</summary>
                <ul>
                  {evs.map((e, n) => (
                    <li key={n}><strong>{STATUS_LABEL[e.status]}</strong> · {e.profiles?.full_name ?? "—"} ({e.cargo}) · {fmt(e.created_at)}{e.observation && <> — “{e.observation}”</>}</li>
                  ))}
                </ul>
              </details>
            )}
          </article>
        );
      })}

      <section className="card">
        <h2>Observaciones generales</h2>
        <form action={setGeneralObservation}>
          <input type="hidden" name="checklist_id" value={id} />
          <textarea name="text" rows={3} defaultValue={cl.general_observation} disabled={!canEdit} />
          {canEdit && <p><button type="submit" className="secondary small">Guardar observaciones</button></p>}
        </form>
      </section>

      {canSign && (
        <section className="card">
          <h2>Firmar como {mine}</h2>
          <p className="muted">Al firmar certificas la revisión de este protocolo. Quedan registrados tu nombre, cargo y la hora.</p>
          <form action={signChecklist}>
            <input type="hidden" name="checklist_id" value={id} />
            <SignaturePad name="signature" />
            <p><button type="submit">Firmar protocolo</button></p>
          </form>
        </section>
      )}
    </>
  );
}
