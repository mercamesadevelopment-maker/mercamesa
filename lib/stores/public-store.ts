/**
 * Lo que se puede saber de una tienda sin gestionarla.
 *
 * `stores` guarda también datos que no son para el público: el correo de
 * contacto del tendero y la dirección donde el mensajero recoge. Las rutas
 * públicas devolvían la fila entera (`select('*')`), así que cualquiera —sin
 * sesión— recibía esos datos aunque ninguna pantalla pública los mostrara.
 *
 * Es una lista de lo que SÍ sale, no de lo que se quita: una columna nueva nace
 * privada, y hacerla pública es una decisión que se toma acá.
 *
 * `contact_name` y `phone` sí son públicos: la página de la plaza muestra quién
 * atiende, y la de la tienda su teléfono.
 */
const PUBLIC_STORE_FIELDS = [
  // Columnas de `stores`.
  'id',
  'marketplace_id',
  'store_group_id',
  'name',
  'slug',
  'description',
  'logo_url',
  'cover_image_url',
  'phone',
  'whatsapp',
  'contact_name',
  'local_address',
  'business_hours',
  'is_active',
  'is_verified',
  'is_wholesale',
  'is_retail',
  'reputation_score',
  'created_at',
  'updated_at',
  // Lo que las rutas le agregan.
  'marketplaces',
  'categories',
  'reviewCount',
  'rating',
  'logoSignedUrl',
  'coverSignedUrl',
  'logoUrl',
] as const;

export function toPublicStore(store: Record<string, unknown>): Record<string, unknown> {
  const publica: Record<string, unknown> = {};
  for (const campo of PUBLIC_STORE_FIELDS) {
    if (campo in store) publica[campo] = store[campo];
  }
  return publica;
}
