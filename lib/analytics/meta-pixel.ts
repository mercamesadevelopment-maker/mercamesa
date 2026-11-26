/**
 * El ID del píxel de Meta, o `null` si no hay que cargarlo.
 *
 * Va dentro de un `<script>`, así que solo se acepta si son dígitos: un valor
 * raro en la variable de entorno no puede terminar ejecutándose en la página.
 */
export function parseMetaPixelId(raw: string | null | undefined): string | null {
  const id = (raw ?? '').trim();
  return /^\d{5,20}$/.test(id) ? id : null;
}
