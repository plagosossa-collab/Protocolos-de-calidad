import ExcelJS from "exceljs";
import { parseLegacyStorage, type LegacyConfig } from "./legacy";

const text = (v: ExcelJS.CellValue): string =>
  v == null ? "" : typeof v === "object" ? ("text" in v ? String(v.text) : "richText" in v ? v.richText.map((r) => r.text).join("") : String(v)) : String(v);

export async function importLegacyXlsx(data: ArrayBuffer): Promise<LegacyConfig> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(data);
  const ws = wb.getWorksheet("Storage") ?? wb.worksheets.find((s) => text(s.getCell(1, 1).value) === "key");
  if (!ws) throw new Error('No se encontró la hoja "Storage" en el archivo');
  const pairs: [string, string][] = [];
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const key = text(row.getCell(1).value);
    if (key.startsWith("config:") || key.startsWith("registro:")) pairs.push([key, text(row.getCell(2).value)]);
  });
  return parseLegacyStorage(pairs);
}
