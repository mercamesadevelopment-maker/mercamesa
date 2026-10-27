/** Texto para comparar o buscar: sin tildes y en minúscula. `null` queda en ''. */
export function normalizeText(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}
