# Arquitectura

Base del producto multi-empresa descrito en el brief "Protocolos de Calidad".

## Stack (Fase 1)
- **Next.js (TypeScript)**: frontend y backend en un solo proyecto.
- **Supabase**: Postgres + Auth + Storage (fotos, firmas y PDFs como archivos; la base solo guarda la ruta).
- **Resend** (pendiente): correo, reemplaza Gmail/Apps Script.
- **Vitest**: tests de la lógica de dominio.

## Decisiones
- **Multi-empresa desde el esquema**: toda tabla de negocio tiene `company_id` y RLS (`supabase/migrations/0001_init.sql`). Evita una reescritura en la Fase 3.
- **Roles y permisos**: `memberships.is_admin` y `memberships.fixed_cargo` son independientes (caso real: Jefe de Terreno que además administra).
- **Historial append-only**: `item_events` solo permite insertar.
- **Lógica de negocio pura** en `src/lib/domain/` (sin dependencias de BD ni UI), testeada: estados, avance, historial, orden de firma, aviso al ITO, importador Excel.

## Mapa del brief
| Regla del brief | Dónde |
|---|---|
| Obra → Edificio → Partida → registro por Partida+Edificio+Depto | tablas `projects`, `buildings`, `partidas`, `checklists` |
| Roles de firma ordenados por partida | `partida_roles.position` |
| Estados y "resuelto" | `checklist.ts` |
| Historial por ítem | `applyChange`, `item_events` |
| Aviso al ITO (Para/CC) | `signing.ts` |
| Importar Excel con columnas dinámicas | `importer.ts`, `importer-xlsx.ts` |

## Roadmap
1. **Base** (en curso): auth, CRUD de obra/edificios/partidas, checklist + firmas + fotos, PDF, aviso al ITO.
2. Multi-obra por empresa.
3. Multi-empresa (aislamiento ya modelado).
4. Comercial: marca blanca, dashboard, offline, WhatsApp, biblioteca de plantillas.

## Pendiente de decidir
- Cuenta/proyecto de Supabase y dominio.
- Migración de los datos de Alborada desde Sheets/Drive.
- Plan de precios.
