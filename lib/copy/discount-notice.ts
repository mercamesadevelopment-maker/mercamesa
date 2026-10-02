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

/** Lo ahorrado en un producto de la canasta. Recibe el valor ya con formato de moneda. */
export const LINE_SAVINGS_LABEL = (amount: string) => `Ahorras ${amount}`;

/** Lo ahorrado en toda la canasta, antes de elegir la dirección. */
export const CART_SAVINGS_LABEL = (amount: string) => `Ahorras ${amount} en esta compra`;

/**
 * Lo mismo, dicho después de comprar: en «Mis Órdenes» y en el detalle del
 * pedido. Recibe el valor ya con formato de moneda.
 */
export const ORDER_SAVINGS_LABEL = (amount: string) => `Ahorraste ${amount} en este pedido`;
