import { redirect } from 'next/navigation';

/** Dispersiones ahora es una pestaña de Contabilidad. */
export default function PayoutsPage() {
  redirect('/admin/accounting?tab=payouts');
}
