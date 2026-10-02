-- Protocolos de Calidad: esquema inicial multi-empresa.
-- Toda tabla de negocio lleva company_id y está protegida por RLS, de modo que
-- la separación de datos por cliente (Fase 3) ya existe desde la Fase 1.

create extension if not exists "pgcrypto";

-- ───────────── Empresas y usuarios ─────────────

create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  logo_path text,
  brand_color text,
  created_at timestamptz not null default now()
);

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  created_at timestamptz not null default now()
);

-- Cargo fijo y administrador son independientes: una persona puede ser
-- Jefe de Terreno y además administrar el sistema.
create table memberships (
  company_id uuid not null references companies (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  is_admin boolean not null default false,
  fixed_cargo text,
  notify_email text,
  created_at timestamptz not null default now(),
  primary key (company_id, user_id)
);

create or replace function is_member(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from memberships where company_id = cid and user_id = auth.uid());
$$;

create or replace function is_admin(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from memberships where company_id = cid and user_id = auth.uid() and is_admin);
$$;

-- ───────────── Obra → Edificio ─────────────

create table projects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table buildings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  project_id uuid not null references projects (id) on delete cascade,
  name text not null,
  floors int not null check (floors > 0),
  units_per_floor int not null check (units_per_floor > 0)
);

-- ───────────── Partidas (protocolos) ─────────────

create table partidas (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  project_id uuid not null references projects (id) on delete cascade,
  name text not null
);

-- Orden de firma de la partida (importa: es el orden real de revisión).
-- El último cargo es quien recibe el aviso (normalmente ITO); los marcados
-- con cc_on_notice van en copia.
create table partida_roles (
  partida_id uuid not null references partidas (id) on delete cascade,
  company_id uuid not null references companies (id) on delete cascade,
  position int not null,
  cargo text not null,
  cc_on_notice boolean not null default false,
  primary key (partida_id, position),
  unique (partida_id, cargo)
);

create table partida_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  partida_id uuid not null references partidas (id) on delete cascade,
  position int not null,
  description text not null,
  document text,
  team text
);

-- ───────────── Registros (checklists) ─────────────

create type item_status as enum ('accepted', 'pending', 'rejected', 'not_applicable');

-- Un registro independiente por Partida + Edificio + Depto.
create table checklists (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  partida_id uuid not null references partidas (id) on delete cascade,
  building_id uuid not null references buildings (id) on delete cascade,
  floor int not null,
  unit int not null,
  created_at timestamptz not null default now(),
  unique (partida_id, building_id, floor, unit)
);

create table checklist_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  checklist_id uuid not null references checklists (id) on delete cascade,
  partida_item_id uuid not null references partida_items (id),
  status item_status not null default 'pending',
  observation text not null default '',
  unique (checklist_id, partida_item_id)
);

-- Historial por ítem: quién, cuándo, con qué cargo y qué dijo. Solo se agrega.
create table item_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  checklist_item_id uuid not null references checklist_items (id) on delete cascade,
  user_id uuid not null references profiles (id),
  cargo text not null,
  status item_status not null,
  observation text not null default '',
  created_at timestamptz not null default now()
);

-- Fotos y firmas son archivos en Storage; la base solo guarda la referencia.
create table photos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  checklist_item_id uuid not null references checklist_items (id) on delete cascade,
  file_path text not null,
  uploaded_by uuid not null references profiles (id),
  created_at timestamptz not null default now()
);

create table signatures (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  checklist_id uuid not null references checklists (id) on delete cascade,
  cargo text not null,
  user_id uuid not null references profiles (id),
  file_path text not null,
  signed_at timestamptz not null default now(),
  unique (checklist_id, cargo)
);

-- Avisos al ITO ya enviados (el aviso en lote repite hasta que el ITO firme).
create table ito_notices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  checklist_id uuid not null references checklists (id) on delete cascade,
  kind text not null check (kind in ('individual', 'batch')),
  sent_at timestamptz not null default now()
);

create index on buildings (project_id);
create index on checklists (partida_id, building_id);
create index on checklist_items (checklist_id);
create index on item_events (checklist_item_id, created_at);
create index on signatures (checklist_id);

-- ───────────── Row Level Security ─────────────

alter table companies enable row level security;
alter table profiles enable row level security;
alter table memberships enable row level security;

create policy companies_read on companies for select using (is_member(id));
create policy companies_admin_update on companies for update using (is_admin(id));
create policy profiles_self on profiles for select using (id = auth.uid());
create policy memberships_read on memberships for select using (is_member(company_id));
create policy memberships_admin on memberships for all using (is_admin(company_id)) with check (is_admin(company_id));

do $$
declare t text;
begin
  foreach t in array array[
    'projects','buildings','partidas','partida_roles','partida_items',
    'checklists','checklist_items','item_events','photos','signatures','ito_notices'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for select using (is_member(company_id))', t || '_read', t);
  end loop;

  -- La configuración (obras, edificios, partidas) la edita un admin.
  foreach t in array array['projects','buildings','partidas','partida_roles','partida_items'] loop
    execute format(
      'create policy %I on %I for all using (is_admin(company_id)) with check (is_admin(company_id))',
      t || '_admin', t);
  end loop;

  -- El trabajo en terreno lo escribe cualquier miembro de la empresa.
  foreach t in array array['checklists','checklist_items','photos','signatures','ito_notices'] loop
    execute format(
      'create policy %I on %I for all using (is_member(company_id)) with check (is_member(company_id))',
      t || '_write', t);
  end loop;
end $$;

-- El historial es append-only: miembros pueden insertar y leer, nadie edita ni borra.
create policy item_events_insert on item_events for insert
  with check (is_member(company_id) and user_id = auth.uid());
