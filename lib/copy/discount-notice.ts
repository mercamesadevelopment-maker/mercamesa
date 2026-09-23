/**
 * Lo que se le dice al comprador cuando su canasta trae productos en oferta.
 *
 * Es texto del cliente y va literal. Vive acá y no dentro del JSX por lo mismo
 * que el aviso de seguridad: es una frase que van a querer ajustar sin tocar
 * código, y en cuanto la use una segunda pantalla —el correo de confirmación,
 * por ejemplo— copiarla sería garantizar que se desincronicen.
 */

export const DISCOUNT_NOTICE_TITLE = 'Tienes descuentos en esta compra';

export const DISCOUNT_NOTICE_BODY =
  'Antes de confirmar tu compra, podrás ver el resumen con los descuentos ' +
  'aplicados y el valor final. Así tendrás la tranquilidad de saber ' +
  'exactamente cuánto vas a pagar.';

export const DISCOUNT_NOTICE_TOTAL_LABEL = 'Ahorro total';
