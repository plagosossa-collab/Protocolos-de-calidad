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
