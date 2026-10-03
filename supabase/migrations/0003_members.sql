-- Gestión de usuarios: ver a los compañeros de empresa e invitar por correo.

create or replace function shares_company(other uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships a join memberships b on a.company_id = b.company_id
    where a.user_id = auth.uid() and b.user_id = other
  );
$$;

-- Los miembros de una empresa pueden ver el nombre de sus compañeros.
create policy profiles_company_read on profiles for select using (shares_company(id));

-- Solo el servidor (clave service_role) puede buscar un usuario por correo.
create or replace function user_id_by_email(p_email text) returns uuid
language sql stable security definer set search_path = public, auth as $$
  select id from auth.users where lower(email) = lower(p_email);
$$;
revoke all on function user_id_by_email(text) from public, anon, authenticated;
grant execute on function user_id_by_email(text) to service_role;

-- Quien crea la empresa queda con su correo registrado.
create or replace function create_company(p_name text, p_slug text) returns uuid
language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then raise exception 'invalid slug'; end if;
  insert into companies (name, slug) values (p_name, p_slug) returning id into cid;
  insert into memberships (company_id, user_id, is_admin, notify_email)
  values (cid, auth.uid(), true, auth.jwt() ->> 'email');
  return cid;
end $$;

-- Completar el correo de membresías creadas antes de esta migración.
update memberships m set notify_email = u.email
from auth.users u where u.id = m.user_id and m.notify_email is null;
