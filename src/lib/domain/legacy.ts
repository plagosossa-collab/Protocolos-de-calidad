/**
 * Lee la configuración de la versión anterior (Google Sheets, hoja "Storage" con
 * filas clave/valor). Solo extrae obra, edificios, cargos y partidas: nunca copia
 * contraseñas ni hashes de usuarios.
 */

export interface LegacyItem { code: string; description: string; document: string; team: string }
export interface LegacyPartida { code: string; name: string; title: string; roles: { cargo: string; cc: boolean }[]; items: LegacyItem[] }
export interface LegacyConfig {
  obra: string;
  buildings: { name: string; floors: number; unitsPerFloor: number }[];
  partidas: LegacyPartida[];
  /** Cantidad de registros (checklists) presentes en la planilla; no se importan aquí. */
  recordCount: number;
}

/** Quita espacios dobles y de los bordes ("SUPERVISOR  SUBCONTRATO" → "SUPERVISOR SUBCONTRATO"). */
export const normCargo = (s: unknown) => String(s ?? "").replace(/\s+/g, " ").trim();

const CC_CARGOS = new Set(["JEFE DE TERRENO", "CONTROL DE CALIDAD"]);

/** En el aviso al ITO iban en copia el Jefe de Terreno y Control de Calidad. */
export function withCc(cargos: string[]): { cargo: string; cc: boolean }[] {
  const seen = new Set<string>();
  const unique = cargos.map(normCargo).filter((c) => c && !seen.has(c.toUpperCase()) && seen.add(c.toUpperCase()));
  return unique.map((cargo, i) => ({ cargo, cc: i < unique.length - 1 && CC_CARGOS.has(cargo.toUpperCase()) }));
}

const parse = (raw: string | undefined, what: string) => {
  if (!raw) throw new Error(`Falta "${what}" en la planilla: ¿es la hoja Storage de la app anterior?`);
  try { return JSON.parse(raw); } catch { throw new Error(`"${what}" no tiene un formato válido`); }
};
const posInt = (n: unknown) => (Number.isInteger(n) && (n as number) > 0 ? (n as number) : null);

export function parseLegacyStorage(pairs: [string, string][]): LegacyConfig {
  const map = new Map(pairs.map(([k, v]) => [k, v]));
  const project = parse(map.get("config:project"), "config:project");
  const partidas = parse(map.get("config:partidas"), "config:partidas");
  if (!Array.isArray(partidas)) throw new Error('"config:partidas" debe ser una lista');

  const obra = String(project.obra ?? "").trim();
  if (!obra) throw new Error("La planilla no indica el nombre de la obra");

  const buildings = (Array.isArray(project.edificios) ? project.edificios : []).map((e: Record<string, unknown>) => {
    const floors = posInt(e.pisos), unitsPerFloor = posInt(e.deptosPorPiso);
    if (!e.nombre || !floors || !unitsPerFloor) throw new Error(`Edificio inválido: ${JSON.stringify(e.nombre)}`);
    return { name: String(e.nombre).trim(), floors, unitsPerFloor };
  });

  return {
    obra,
    buildings,
    partidas: partidas.map((p: Record<string, unknown>) => ({
      code: String(p.codigo ?? "").trim(),
      name: String(p.nombre ?? "").trim(),
      title: String(p.titulo ?? "").trim(),
      roles: withCc(Array.isArray(p.roles) ? p.roles : []),
      items: (Array.isArray(p.items) ? p.items : []).map((it: Record<string, unknown>) => ({
        code: String(it.id ?? "").trim(),
        description: String(it.texto ?? "").trim(),
        document: String(it.doc ?? "").trim(),
        team: String(it.equipo ?? "").trim(),
      })).filter((it: LegacyItem) => it.description),
    })).filter((p: LegacyPartida) => p.name),
    recordCount: pairs.filter(([k]) => k.startsWith("registro:")).length,
  };
}
