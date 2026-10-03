-- Módulo de checklist en terreno. Las escrituras pasan por funciones que hacen cumplir
-- las reglas (cargo propio, orden de firma, protocolo cerrado), no por inserts directos.

alter table checklists add column if not exists general_observation text not null default '';
alter table checklists add column if not exists element text not null default '';

-- Ya no se escribe directo en estas tablas: solo lectura + funciones.
drop policy if exists checklists_write on checklists;
drop policy if exists checklist_items_write on checklist_items;
drop policy if exists photos_write on photos;
drop policy if exists signatures_write on signatures;
drop policy if exists item_events_insert on item_events;

-- Evidencia (fotos y firmas): bucket privado, se ve con URLs firmadas. Sin update ni delete.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('evidence', 'evidence', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
create policy evidence_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'evidence' and is_member(((storage.foldername(name))[1])::uuid));
create policy evidence_select on storage.objects for select to authenticated
  using (bucket_id = 'evidence' and is_member(((storage.foldername(name))[1])::uuid));

-- ───── Utilidades ─────
create or replace function norm_cargo(s text) returns text language sql immutable as $$
  select upper(regexp_replace(trim(coalesce(s, '')), '\s+', ' ', 'g'))
$$;

create or replace function my_cargo(cid uuid) returns text
language sql stable security definer set search_path = public as $$
  select fixed_cargo from memberships where company_id = cid and user_id = auth.uid()
$$;

-- Un protocolo queda cerrado cuando firma el último cargo de la partida.
create or replace function checklist_closed(cl uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from signatures s join checklists c on c.id = s.checklist_id
    where s.checklist_id = cl and norm_cargo(s.cargo) = norm_cargo((
      select r.cargo from partida_roles r where r.partida_id = c.partida_id order by r.position desc limit 1))
  )
$$;

-- Verifica que quien llama sea miembro con un cargo que participa en la partida; devuelve el cargo canónico.
create or replace function acting_cargo(cl uuid, must_be_open boolean default true) returns text
language plpgsql stable security definer set search_path = public as $$
declare c checklists; mine text; canon text;
begin
  select * into c from checklists where id = cl;
  if not found or not is_member(c.company_id) then raise exception 'No tienes acceso a este protocolo'; end if;
  mine := my_cargo(c.company_id);
  if mine is null or btrim(mine) = '' then raise exception 'Tu usuario no tiene un cargo asignado'; end if;
  select r.cargo into canon from partida_roles r where r.partida_id = c.partida_id and norm_cargo(r.cargo) = norm_cargo(mine);
  if canon is null then raise exception 'Tu cargo (%) no participa en esta partida', mine; end if;
  if must_be_open and checklist_closed(cl) then raise exception 'El protocolo ya fue firmado por el último cargo y está cerrado'; end if;
  return canon;
end $$;

-- ───── Operaciones ─────
create or replace function ensure_checklist(p_partida uuid, p_building uuid, p_floor int, p_unit int) returns uuid
language plpgsql security definer set search_path = public as $$
declare cid uuid; b buildings; cl uuid;
begin
  select company_id into cid from partidas where id = p_partida;
  if cid is null or not is_member(cid) then raise exception 'No tienes acceso a esta partida'; end if;
  select * into b from buildings where id = p_building and company_id = cid;
  if not found then raise exception 'Edificio inválido'; end if;
  if p_floor < 1 or p_floor > b.floors or p_unit < 1 or p_unit > b.units_per_floor then raise exception 'Depto fuera de rango'; end if;

  insert into checklists (company_id, partida_id, building_id, floor, unit)
  values (cid, p_partida, p_building, p_floor, p_unit)
  on conflict (partida_id, building_id, floor, unit) do nothing returning id into cl;
  if cl is null then
    select id into cl from checklists where partida_id = p_partida and building_id = p_building and floor = p_floor and unit = p_unit;
  end if;
  -- Incorpora también ítems agregados a la partida después de crear el registro.
  insert into checklist_items (company_id, checklist_id, partida_item_id)
  select cid, cl, i.id from partida_items i where i.partida_id = p_partida
  on conflict (checklist_id, partida_item_id) do nothing;
  return cl;
end $$;

create or replace function set_item_state(p_item uuid, p_status item_status, p_observation text) returns void
language plpgsql security definer set search_path = public as $$
declare it checklist_items; cargo text;
begin
  select * into it from checklist_items where id = p_item for update;
  if not found then raise exception 'Ítem no encontrado'; end if;
  cargo := acting_cargo(it.checklist_id);
  p_observation := coalesce(p_observation, '');
  if p_status is distinct from it.status or p_observation is distinct from it.observation then
    update checklist_items set status = p_status, observation = p_observation where id = p_item;
    insert into item_events (company_id, checklist_item_id, user_id, cargo, status, observation)
    values (it.company_id, p_item, auth.uid(), cargo, p_status, p_observation);
  end if;
end $$;

create or replace function set_general_observation(p_checklist uuid, p_text text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform acting_cargo(p_checklist);
  update checklists set general_observation = coalesce(p_text, '') where id = p_checklist;
end $$;

create or replace function add_photo(p_item uuid, p_path text) returns void
language plpgsql security definer set search_path = public as $$
declare it checklist_items;
begin
  select * into it from checklist_items where id = p_item;
  if not found then raise exception 'Ítem no encontrado'; end if;
  perform acting_cargo(it.checklist_id);
  if split_part(p_path, '/', 1) <> it.company_id::text then raise exception 'Ruta de archivo inválida'; end if;
  insert into photos (company_id, checklist_item_id, file_path, uploaded_by) values (it.company_id, p_item, p_path, auth.uid());
end $$;

-- Firma: el cargo sale del perfil, exige que todos los anteriores hayan firmado y que no haya firmado ya.
create or replace function sign_checklist(p_checklist uuid, p_file_path text) returns void
language plpgsql security definer set search_path = public as $$
declare c checklists; canon text; pos int; missing text;
begin
  canon := acting_cargo(p_checklist);
  select * into c from checklists where id = p_checklist;
  if split_part(p_file_path, '/', 1) <> c.company_id::text then raise exception 'Ruta de archivo inválida'; end if;
  if exists (select 1 from signatures where checklist_id = p_checklist and norm_cargo(cargo) = norm_cargo(canon)) then
    raise exception 'Tu cargo ya firmó este protocolo';
  end if;
  select position into pos from partida_roles where partida_id = c.partida_id and cargo = canon;
  select r.cargo into missing from partida_roles r
  where r.partida_id = c.partida_id and r.position < pos
    and not exists (select 1 from signatures s where s.checklist_id = p_checklist and norm_cargo(s.cargo) = norm_cargo(r.cargo))
  order by r.position limit 1;
  if missing is not null then raise exception 'Antes debe firmar: %', missing; end if;
  insert into signatures (company_id, checklist_id, cargo, user_id, file_path) values (c.company_id, p_checklist, canon, auth.uid(), p_file_path);
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'ensure_checklist(uuid,uuid,int,int)', 'set_item_state(uuid,item_status,text)', 'set_general_observation(uuid,text)',
    'add_photo(uuid,text)', 'sign_checklist(uuid,text)', 'acting_cargo(uuid,boolean)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
