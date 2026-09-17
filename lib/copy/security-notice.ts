/**
 * Aviso de seguridad para el comprador, redactado por el cliente.
 *
 * Vive en un solo archivo porque lo usan dos pantallas de features distintas
 * —el carrito y el detalle del pedido—, y copiarlo garantizaría que se
 * desincronicen en cuanto pidan ajustar una frase.
 *
 * El texto se reparte por momentos, no se recorta: entero antes de pagar son
 * ~180 palabras justo encima del botón de pago, que es el punto donde más gente
 * abandona. Además, el consejo del código de entrega no se puede aplicar todavía
 * cuando se lee: el código aparece después, cuando el pedido va en camino.
 */

export const SECURITY_NOTICE_TITLE = 'Protege tu pedido y tu información';

/**
 * Siempre visible: es la frase que corta el fraude más común, el de quien llama
 * haciéndose pasar por la plataforma.
 */
export const SECURITY_NOTICE_SUMMARY =
  'MercaMesa nunca te solicitará contraseñas, códigos de acceso, códigos bancarios ni códigos de verificación de tus cuentas.';

/** Detrás del desplegable, en el paso de pago. */
export const SECURITY_NOTICE_DETAILS: string[] = [
  'El operador encargado de la entrega recibe únicamente la información necesaria para llevar tu pedido al destino indicado.',
  'Si alguien te solicita otros códigos, datos bancarios o información confidencial, no respondas, finaliza la comunicación y repórtalo de inmediato a través de los canales oficiales de MercaMesa.',
  // Enlaza los dos momentos: lo del código se explica donde el código existe.
  'Cuando tu pedido esté en camino, en su detalle te explicamos cómo manejar el código de entrega.',
];

export const DELIVERY_CODE_NOTICE_TITLE = 'Protege tu pedido';

/**
 * En el detalle del pedido, que es donde el comprador tendrá el código delante
 * y donde el consejo sirve de algo.
 */
export const DELIVERY_CODE_NOTICE: string[] = [
  'Si tu pedido tiene un código de entrega, compártelo únicamente con el domiciliario asignado y solo cuando tengas el pedido en tus manos. Nunca lo informes anticipadamente por llamada, mensaje o chat, aunque alguien se comunique en nombre de MercaMesa.',
  'Compartir este código es autorizar a otro que reclame y disfrute el pedido en tu nombre.',
  SECURITY_NOTICE_SUMMARY,
  'Si alguien te solicita otros códigos, datos bancarios o información confidencial, no respondas, finaliza la comunicación y repórtalo de inmediato a través de los canales oficiales de MercaMesa.',
];
