# Protocolos de Calidad

App de checklists de calidad en obra, multi-empresa. Ver `docs/ARQUITECTURA.md`.

```bash
npm install
cp .env.example .env.local   # completar con tu proyecto Supabase
npm run dev
npm test
```

Aplicar en orden, en el SQL editor de Supabase, `supabase/migrations/0001_init.sql` y `0002_auth.sql`.

Variables en `.env.local`: `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`
(Supabase → Project Settings → API). Nunca pongas la `service_role` en variables `NEXT_PUBLIC_*`.

Para pruebas rápidas, en Authentication → Providers → Email puedes desactivar
"Confirm email"; si queda activo, el registro pide confirmar el correo antes de entrar.

Flujo: `/login` (entrar o crear cuenta) → `/onboarding` (crear empresa, queda como administrador) → `/app`.

## Invitación de usuarios

Aplicar también `supabase/migrations/0003_members.sql`.

Variable de servidor (Vercel → Environment Variables, **sin** prefijo `NEXT_PUBLIC_`):
`SUPABASE_SERVICE_ROLE_KEY` (clave secreta; nunca en GitHub ni en el navegador).

En Supabase → Authentication → Email Templates → **Invite user**, usar este enlace
(así la sesión se canjea en el servidor, en `/auth/confirm`):

```html
<h2>Te invitaron a Protocolos de Calidad</h2>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/set-password">Aceptar invitación y definir contraseña</a></p>
```

`Site URL` (Authentication → URL Configuration) debe ser la dirección fija de la app.
El correo integrado de Supabase tiene un límite muy bajo de envíos por hora: para uso real,
configurar SMTP propio (p. ej. Resend) en Authentication → SMTP Settings.
