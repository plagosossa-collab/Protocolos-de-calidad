-- Perfil automático al registrarse en Supabase Auth.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(new.email, '@', 1)));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Crea una empresa y deja a quien llama como su primer administrador.
-- Es la única vía para crear empresas: companies no tiene policy de insert.
create or replace function create_company(p_name text, p_slug text) returns uuid
language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then raise exception 'invalid slug'; end if;
  insert into companies (name, slug) values (p_name, p_slug) returning id into cid;
  insert into memberships (company_id, user_id, is_admin) values (cid, auth.uid(), true);
  return cid;
end $$;

revoke all on function create_company(text, text) from public, anon;
grant execute on function create_company(text, text) to authenticated;
