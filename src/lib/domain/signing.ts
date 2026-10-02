import { isResolved, type Item } from "./checklist";

export interface RoleSlot {
  cargo: string;
  /** Va en copia (CC) cuando se avisa al último cargo. */
  ccOnNotice: boolean;
  email?: string | null;
}

/** Orden de firma: lista ordenada de cargos de la partida. */
export function nextToSign(roles: string[], signed: string[]): string | null {
  return roles.find((r) => !signed.includes(r)) ?? null;
}

/**
 * Se puede avisar al último cargo (normalmente ITO) cuando todos los cargos
 * previos firmaron, no quedan ítems pendientes/rechazados y el último aún no firmó.
 */
export function readyForFinalNotice(roles: string[], signed: string[], items: Pick<Item, "status">[]): boolean {
  if (roles.length < 2) return false;
  const last = roles[roles.length - 1];
  const previous = roles.slice(0, -1);
  return previous.every((r) => signed.includes(r)) && !signed.includes(last) && isResolved(items);
}

/** "Para" = último cargo; "CC" = cargos intermedios marcados en la partida. Sin correo → se omite. */
export function noticeRecipients(slots: RoleSlot[]): { to: string | null; cc: string[] } {
  const last = slots[slots.length - 1];
  const cc = slots
    .slice(0, -1)
    .filter((s) => s.ccOnNotice && s.email)
    .map((s) => s.email as string);
  return { to: last?.email ?? null, cc: [...new Set(cc)] };
}
