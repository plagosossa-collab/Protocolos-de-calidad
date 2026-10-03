import type { ItemStatus } from "./checklist";
import { isResolved } from "./checklist";

export const STATUS_LABEL: Record<ItemStatus, string> = {
  accepted: "Aceptado",
  pending: "Pendiente",
  rejected: "Rechazado",
  not_applicable: "No aplica",
};
export const STATUSES: ItemStatus[] = ["accepted", "pending", "rejected", "not_applicable"];

/** Clave comparable de un cargo: sin espacios dobles y en mayúsculas (igual que norm_cargo en SQL). */
export const cargoKey = (s: string) => s.replace(/\s+/g, " ").trim().toUpperCase();

/** Número de depto como se dice en obra: piso 9, unidad 4 → "904"; piso 11, unidad 8 → "1108". */
export const unitLabel = (floor: number, unit: number) => `${floor}${String(unit).padStart(2, "0")}`;

export type CellState = "none" | "progress" | "rejected" | "resolved" | "closed";
export const CELL_LABEL: Record<CellState, string> = {
  none: "Sin iniciar",
  progress: "En revisión",
  rejected: "Con rechazos",
  resolved: "Resuelto",
  closed: "Firmado por todos",
};

/** Estado de un registro para el tablero. `roles` va en orden de firma; el último cierra el protocolo. */
export function cellState(items: { status: ItemStatus }[] | null, roles: string[], signed: string[]): CellState {
  if (!items) return "none";
  const last = roles.length ? cargoKey(roles[roles.length - 1]) : null;
  if (last && signed.some((s) => cargoKey(s) === last)) return "closed";
  if (items.some((i) => i.status === "rejected")) return "rejected";
  return isResolved(items) ? "resolved" : "progress";
}

/** Cargo que debe firmar ahora (el primero sin firma), o null si ya firmaron todos. */
export function nextSigner(roles: string[], signed: string[]): string | null {
  const done = new Set(signed.map(cargoKey));
  return roles.find((r) => !done.has(cargoKey(r))) ?? null;
}
