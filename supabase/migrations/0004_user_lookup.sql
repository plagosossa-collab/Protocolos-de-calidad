-- Reemplaza user_id_by_email: además indica si la persona fue invitada y nunca ha entrado.
drop function if exists user_id_by_email(text);

create or replace function user_by_email(p_email text)
returns table (id uuid, pending_invite boolean)
language sql stable security definer set search_path = public, auth as $$
  select u.id, (u.invited_at is not null and u.last_sign_in_at is null)
  from auth.users u where lower(u.email) = lower(p_email);
$$;
revoke all on function user_by_email(text) from public, anon, authenticated;
grant execute on function user_by_email(text) to service_role;
