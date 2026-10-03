import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * Prueba las migraciones y las reglas de negocio de verdad (Postgres en memoria, con roles y RLS),
 * simulando solo lo que aporta Supabase: auth.users / auth.uid() y el esquema storage.
 */
const STUBS = `
create role anon nologin; create role authenticated nologin; create role service_role nologin;
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}',
  invited_at timestamptz, last_sign_in_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('email', current_setting('request.jwt.claim.email', true)) $$;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
grant usage on schema auth, storage to anon, authenticated, service_role;
`;

let db: PGlite;
const id = async (sql: string, params: unknown[] = []) => (await db.query<{ id: string }>(sql, params)).rows[0].id;
/** Ejecuta como un usuario autenticado de Supabase (aplica RLS). */
async function as<T>(user: string, fn: () => Promise<T>): Promise<T> {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${user}', false), set_config('request.jwt.claim.email', '${user}@x.cl', false)`);
  try { return await fn(); } finally { await db.exec("reset role"); }
}
const fails = async (p: Promise<unknown>, re: RegExp) => { await expect(p).rejects.toThrow(re); };

let A: string, B: string, C: string, D: string, company: string, other: string, partida: string, building: string, items: string[];

beforeAll(async () => {
  db = new PGlite();
  await db.exec(STUBS);
  const dir = path.resolve(__dirname, "../../supabase/migrations");
  for (const f of readdirSync(dir).sort()) {
    await db.exec(readFileSync(path.join(dir, f), "utf8").replace(/create extension if not exists "pgcrypto";/, ""));
  }
  await db.exec(`grant all on all tables in schema public to authenticated, service_role; grant all on all tables in schema storage to authenticated;`);

  const user = (email: string) => id("insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id", [email, JSON.stringify({ full_name: email })]);
  [A, B, C, D] = [await user("a@x.cl"), await user("b@x.cl"), await user("c@x.cl"), await user("d@x.cl")];

  company = await as(A, async () => (await db.query<{ create_company: string }>("select create_company('Alborada','alborada')")).rows[0].create_company);
  other = await as(D, async () => (await db.query<{ create_company: string }>("select create_company('Otra','otra')")).rows[0].create_company);
  await db.query("update memberships set fixed_cargo = 'JEFE DE TERRENO' where user_id = $1", [A]);
  await db.query("insert into memberships (company_id, user_id, fixed_cargo) values ($1,$2,'ITO'), ($1,$3,null)", [company, B, C]);

  await as(A, async () => {
    const project = await id("insert into projects (company_id, name) values ($1,'Obra') returning id", [company]);
    building = await id("insert into buildings (company_id, project_id, name, floors, units_per_floor) values ($1,$2,'Torre A',2,2) returning id", [company, project]);
    partida = await id("insert into partidas (company_id, project_id, name) values ($1,$2,'Trazado') returning id", [company, project]);
    await db.query(`select set_partida_roles($1, '[{"cargo":"Jefe de  Terreno","cc":true},{"cargo":"ITO","cc":false}]'::jsonb)`, [partida]);
    items = [];
    for (const [k, d] of ["Ítem 1", "Ítem 2"].entries()) {
      items.push(await id("insert into partida_items (company_id, partida_id, position, description) values ($1,$2,$3,$4) returning id", [company, partida, k, d]));
    }
  });
});

describe("reglas del checklist en la base de datos", () => {
  let cl: string;
  let ci: string[];

  it("crea el registro con sus ítems y es idempotente", async () => {
    cl = await as(A, async () => (await db.query<{ ensure_checklist: string }>("select ensure_checklist($1,$2,2,2)", [partida, building])).rows[0].ensure_checklist);
    const again = await as(A, async () => (await db.query<{ ensure_checklist: string }>("select ensure_checklist($1,$2,2,2)", [partida, building])).rows[0].ensure_checklist);
    expect(again).toBe(cl);
    ci = (await db.query<{ id: string }>("select ci.id from checklist_items ci join partida_items pi on pi.id = ci.partida_item_id where ci.checklist_id = $1 order by pi.position", [cl])).rows.map((r) => r.id);
    expect(ci).toHaveLength(2);
    await as(A, () => fails(db.query("select ensure_checklist($1,$2,3,1)", [partida, building]), /fuera de rango/));
  });

  it("no se puede escribir directo en las tablas, solo por funciones", async () => {
    await as(A, () => fails(db.query("update checklist_items set status = 'accepted' where checklist_id = $1", [cl]).then((r) => { if (!r.affectedRows) throw new Error("sin permiso"); }), /sin permiso/));
    await as(A, () => fails(db.query("insert into signatures (company_id, checklist_id, cargo, user_id, file_path) values ($1,$2,'ITO',$3,'x')", [company, cl, A]), /row-level security/));
  });

  it("registra historial con el cargo del perfil y ignora cambios nulos", async () => {
    await as(A, () => db.query("select set_item_state($1,'rejected','grieta')", [ci[0]]).then(() => db.query("select set_item_state($1,'rejected','grieta')", [ci[0]])));
    const ev = (await db.query<{ cargo: string; status: string }>("select cargo, status from item_events")).rows;
    expect(ev).toEqual([{ cargo: "Jefe de Terreno", status: "rejected" }].map((e) => ({ ...e, cargo: expect.stringMatching(/Jefe de\s+Terreno/) as unknown as string })));
    await as(B, () => db.query("select set_item_state($1,'accepted','corregido')", [ci[0]]));
    expect((await db.query("select 1 from item_events where checklist_item_id = $1", [ci[0]])).rows).toHaveLength(2);
  });

  it("exige cargo asignado y que participe en la partida", async () => {
    await as(C, () => fails(db.query("select set_item_state($1,'accepted','')", [ci[1]]), /no tiene un cargo/));
    await db.query("update memberships set fixed_cargo = 'BODEGA' where user_id = $1", [C]);
    await as(C, () => fails(db.query("select set_item_state($1,'accepted','')", [ci[1]]), /no participa/));
  });

  it("aísla los datos entre empresas", async () => {
    await as(D, async () => {
      expect((await db.query("select 1 from checklists")).rows).toHaveLength(0);
      await fails(db.query("select set_item_state($1,'accepted','')", [ci[1]]), /No tienes acceso/);
    });
  });

  it("respeta el orden de firma y cierra el protocolo", async () => {
    await db.query("update memberships set fixed_cargo = null where user_id = $1", [C]);
    const path = (n: string) => `${company}/${cl}/${n}.png`;
    await as(B, () => fails(db.query("select sign_checklist($1,$2)", [cl, path("b")]), /Antes debe firmar/));
    await as(A, () => fails(db.query("select sign_checklist($1,$2)", [cl, `${other}/x.png`]), /Ruta de archivo inválida/));
    await as(A, () => db.query("select sign_checklist($1,$2)", [cl, path("a")]));
    await as(A, () => fails(db.query("select sign_checklist($1,$2)", [cl, path("a2")]), /ya firmó/));
    await as(B, () => db.query("select sign_checklist($1,$2)", [cl, path("b")]));
    expect((await db.query<{ checklist_closed: boolean }>("select checklist_closed($1)", [cl])).rows[0].checklist_closed).toBe(true);
    await as(A, () => fails(db.query("select set_item_state($1,'accepted','')", [ci[1]]), /cerrado/));
  });
});
