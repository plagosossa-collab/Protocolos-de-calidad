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

Al invitar, la app genera un **enlace de un solo uso** que el administrador comparte por el medio
que prefiera (p. ej. WhatsApp); se canjea en `/auth/confirm` y lleva a `/set-password`.
No requiere SMTP ni editar plantillas de Supabase (en el plan gratuito editarlas exige SMTP propio).
Aplicar también `0004_user_lookup.sql`.

Más adelante, con un dominio propio, se podrá configurar SMTP (p. ej. Resend) para enviar el enlace por correo.
