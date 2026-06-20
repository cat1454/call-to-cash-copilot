export function normalizeForSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[đĐ]/gu, "d")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}
