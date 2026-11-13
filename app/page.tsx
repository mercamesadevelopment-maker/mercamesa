import { getMeteorWhatsappNumber } from '@/lib/env';
import { HomePage } from '@/features/home/components/HomePage';

/**
 * La página de inicio. Solo arma, en el servidor, el enlace a Carolina en
 * WhatsApp (la línea de compradores de Meteor); lo demás está en `HomePage`.
 */
export default function Page() {
  const numero = getMeteorWhatsappNumber('compradores');
  const whatsappUrl = numero
    ? `https://wa.me/${numero.replace(/\D/g, '')}?text=${encodeURIComponent('Hola Carolina, quiero mercar')}`
    : null;

  return <HomePage whatsappUrl={whatsappUrl} />;
}
