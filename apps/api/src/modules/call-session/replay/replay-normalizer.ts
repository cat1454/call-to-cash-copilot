export function normalizeForSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[Ä‘Ä]/gu, "d")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}
