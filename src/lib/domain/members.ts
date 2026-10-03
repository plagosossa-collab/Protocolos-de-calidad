export interface Member {
  userId: string;
  isAdmin: boolean;
}

/** Una empresa nunca puede quedarse sin administradores. */
export function leavesNoAdmin(
  members: Member[],
  userId: string,
  change: { remove?: boolean; isAdmin?: boolean },
): boolean {
  const after = members
    .filter((m) => !(change.remove && m.userId === userId))
    .map((m) => (m.userId === userId && change.isAdmin !== undefined ? { ...m, isAdmin: change.isAdmin } : m));
  return !after.some((m) => m.isAdmin);
}
