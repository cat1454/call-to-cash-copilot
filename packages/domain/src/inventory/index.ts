export function isInventoryHoldActive(
  inventoryHoldActive: boolean,
  inventoryHoldExpiresAt: string | undefined,
  now: string | Date
): boolean {
  if (!inventoryHoldActive || inventoryHoldExpiresAt === undefined) {
    return false;
  }

  const expiresAt = Date.parse(inventoryHoldExpiresAt);
  const currentTime = typeof now === "string" ? Date.parse(now) : now.getTime();

  return Number.isFinite(expiresAt) && Number.isFinite(currentTime) && expiresAt > currentTime;
}
