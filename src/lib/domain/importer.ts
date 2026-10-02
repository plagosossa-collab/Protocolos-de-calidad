export interface ImportedItem {
  description: string;
  document: string;
  team: string;
}

const HEADERS = {
  description: ["partidas a controlar", "partida a controlar"],
  document: ["documento"],
  team: ["equipo"],
} as const;

const norm = (v: unknown) =>
  String(v ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();

/**
 * Las plantillas de clientes no tienen las columnas en la misma posición:
 * se busca la fila de encabezados y se detecta la columna de cada uno.
 */
export function parseChecklistRows(rows: unknown[][]): ImportedItem[] {
  for (let r = 0; r < rows.length; r++) {
    const cells = rows[r].map(norm);
    const col = {
      description: cells.findIndex((c) => (HEADERS.description as readonly string[]).includes(c)),
      document: cells.findIndex((c) => (HEADERS.document as readonly string[]).includes(c)),
      team: cells.findIndex((c) => (HEADERS.team as readonly string[]).includes(c)),
    };
    if (col.description < 0) continue;
    const text = (row: unknown[], i: number) => (i < 0 ? "" : String(row[i] ?? "").trim());
    return rows
      .slice(r + 1)
      .map((row) => ({
        description: text(row, col.description),
        document: text(row, col.document),
        team: text(row, col.team),
      }))
      .filter((i) => i.description !== "");
  }
  throw new Error('No se encontró la columna "Partidas a controlar" en la planilla');
}
