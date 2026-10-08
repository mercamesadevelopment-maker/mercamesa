/**
 * Límites de los campos de una dirección, compartidos por el formulario y por
 * la validación del servidor.
 *
 * Viven en su propio archivo, sin importar nada, porque el formulario corre en
 * el navegador: si los tomara de `sanitize-address.ts` arrastraría al bundle del
 * cliente el módulo de geocodificación, que lee el token de servidor de Mapbox.
 */

/**
 * Tope de las indicaciones de entrega.
 *
 * Es un campo libre que termina en el payload de Pibox, así que no puede quedar
 * sin límite. 300 caracteres alcanzan de sobra para "Apartamento 302, segundo
 * piso. Timbre dañado, llamar al llegar."
 */
export const MAX_DELIVERY_INSTRUCTIONS = 300;

/**
 * Mínimo de las indicaciones de entrega, que son obligatorias.
 *
 * El punto del mapa lleva al mensajero a la cuadra; lo que falta para llegar a
 * la puerta —torre, apartamento, portón— solo lo sabe el comprador. Diez
 * caracteres descartan un "." o un "casa" sin pedir un párrafo. La base exige
 * el mismo mínimo (`fn_delivery_address_requires_location`).
 */
export const MIN_DELIVERY_INSTRUCTIONS = 10;
