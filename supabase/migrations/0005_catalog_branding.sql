-- Logo y colores por empresa (bucket público de solo lectura; escritura solo admins).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('branding', 'branding', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

-- Los archivos van en la carpeta <company_id>/...
create policy branding_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'branding' and is_admin(((storage.foldername(name))[1])::uuid));
create policy branding_update on storage.objects for update to authenticated
  using (bucket_id = 'branding' and is_admin(((storage.foldername(name))[1])::uuid));
create policy branding_delete on storage.objects for delete to authenticated
  using (bucket_id = 'branding' and is_admin(((storage.foldername(name))[1])::uuid));

-- Reemplaza atómicamente la lista ordenada de cargos de una partida.
-- p_roles: [{"cargo": "ITO", "cc": false}, ...] en orden de firma.
create or replace function set_partida_roles(p_partida uuid, p_roles jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  select company_id into cid from partidas where id = p_partida;
  if cid is null or not is_admin(cid) then raise exception 'not allowed'; end if;
  delete from partida_roles where partida_id = p_partida;
  insert into partida_roles (partida_id, company_id, position, cargo, cc_on_notice)
  select p_partida, cid, ord - 1, trim(r ->> 'cargo'), coalesce((r ->> 'cc')::boolean, false)
  from jsonb_array_elements(p_roles) with ordinality as t(r, ord);
end $$;
revoke all on function set_partida_roles(uuid, jsonb) from public, anon;
grant execute on function set_partida_roles(uuid, jsonb) to authenticated;
