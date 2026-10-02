import ExcelJS from "exceljs";
import { parseChecklistRows, type ImportedItem } from "./importer";

export async function importChecklistXlsx(data: ArrayBuffer): Promise<ImportedItem[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(data);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error("El archivo no tiene hojas");
  const rows: unknown[][] = [];
  ws.eachRow({ includeEmpty: true }, (row) => {
    // row.values es 1-indexado: el primer elemento está vacío.
    rows.push((row.values as unknown[]).slice(1).map((v) => (v && typeof v === "object" && "text" in v ? (v as { text: string }).text : v)));
  });
  return parseChecklistRows(rows);
}
