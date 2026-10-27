/**
 * La autorización que acepta quien registra la cuenta donde se le paga a una
 * tienda. Cada cuenta guarda la versión que se aceptó
 * (`store_bank_accounts.authorization_version`).
 *
 * Si el texto cambia, cambia la versión: las cuentas ya registradas conservan la
 * que aceptaron, y la nueva aplica desde la próxima cuenta que se registre.
 */
export const PAYOUT_AUTHORIZATION_VERSION = '2026-10-27';

export const PAYOUT_AUTHORIZATION_TITLE =
  'Autorización para la dispersión de fondos y el pago de devoluciones o saldos a favor';

export const PAYOUT_AUTHORIZATION_PARAGRAPHS = [
  'Al diligenciar este formulario, aceptar esta autorización y enviarlo, autorizo expresamente a T-Agro Consultores S.A.S., identificada con NIT 901108429 (MercaMesa), a transferir a la cuenta bancaria aquí registrada los valores que me correspondan por concepto de dispersión de fondos, devolución de dinero o saldo a favor relacionados con esta solicitud.',
  'Declaro que la información suministrada es veraz, completa y actualizada, y que estoy facultado para designar la cuenta indicada como destino del pago. Me comprometo a verificar, antes de enviar el formulario, la entidad financiera, el tipo y número de cuenta y la identificación de su titular.',
  'Asumo la responsabilidad por las transferencias a una cuenta equivocada que se originen exclusivamente en errores u omisiones en la información bancaria que suministre, siempre que T-Agro Consultores S.A.S. haya realizado la transferencia conforme a los datos registrados y cumplido las verificaciones y obligaciones que le sean exigibles.',
  'Esta disposición no exonera a T-Agro Consultores S.A.S. de responsabilidad por errores propios, negligencia o incumplimiento de sus obligaciones legales.',
];

export const PAYOUT_AUTHORIZATION_CHECKBOX =
  'He leído y acepto esta autorización, y confirmo que he verificado los datos de la cuenta bancaria proporcionada.';
