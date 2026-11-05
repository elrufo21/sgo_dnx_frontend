export type WarehouseCount = { wholesale: string; dispatch: string; display: string };

export function calculateWarehouseCount(count: WarehouseCount, unitsPerBox: number | null) {
  const wholesale = Number(count.wholesale || 0);
  const dispatch = Number(count.dispatch || 0);
  const display = Number(count.display || 0);
  const hasValues = count.wholesale !== "" || count.dispatch !== "" || count.display !== "";
  const wholesaleTotal = wholesale * (unitsPerBox ?? 0);
  return { hasValues, wholesaleTotal, total: wholesaleTotal + dispatch + display };
}
