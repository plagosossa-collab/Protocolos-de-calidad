export type ItemStatus = "accepted" | "pending" | "rejected" | "not_applicable";

export interface Item {
  status: ItemStatus;
  observation: string;
}

export interface ItemEvent {
  userId: string;
  cargo: string;
  status: ItemStatus;
  observation: string;
  at: Date;
}

/** Un protocolo está "resuelto" cuando no quedan ítems Pendiente ni Rechazado. */
export function isResolved(items: Pick<Item, "status">[]): boolean {
  return items.every((i) => i.status !== "pending" && i.status !== "rejected");
}

/** Porcentaje de ítems resueltos (No aplica cuenta como resuelto). */
export function progress(items: Pick<Item, "status">[]): number {
  if (items.length === 0) return 0;
  const done = items.filter((i) => i.status === "accepted" || i.status === "not_applicable").length;
  return Math.round((done / items.length) * 100);
}

/**
 * Aplica un cambio a un ítem. Devuelve el ítem nuevo y el evento de historial,
 * o `event: null` si no cambió ni el estado ni la observación.
 * El historial se conserva aunque el estado final sea "Aceptado".
 */
export function applyChange(
  item: Item,
  change: { userId: string; cargo: string; status?: ItemStatus; observation?: string; at?: Date },
): { item: Item; event: ItemEvent | null } {
  const status = change.status ?? item.status;
  const observation = change.observation ?? item.observation;
  if (status === item.status && observation === item.observation) return { item, event: null };
  return {
    item: { status, observation },
    event: { userId: change.userId, cargo: change.cargo, status, observation, at: change.at ?? new Date() },
  };
}
