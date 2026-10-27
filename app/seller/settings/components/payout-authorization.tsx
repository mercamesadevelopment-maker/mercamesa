import { FileSignature } from 'lucide-react';
import {
  PAYOUT_AUTHORIZATION_CHECKBOX,
  PAYOUT_AUTHORIZATION_PARAGRAPHS,
  PAYOUT_AUTHORIZATION_TITLE,
} from '@/lib/payouts/authorization';

/**
 * La autorización de pago, con la casilla para aceptarla. Sin aceptarla no se
 * registra la cuenta: lo exigen la ruta y la base, no solo esta casilla.
 */
export function PayoutAuthorization({
  accepted,
  onChange,
}: {
  accepted: boolean;
  onChange: (accepted: boolean) => void;
}) {
  return (
    <div className="space-y-3 rounded-2xl border border-mm-crd/60 bg-mm-gbg/20 p-4">
      <p className="flex items-start gap-2 text-sm font-bold text-mm-g">
        <FileSignature className="mt-0.5 h-4 w-4 shrink-0" />
        {PAYOUT_AUTHORIZATION_TITLE}
      </p>
      <div className="space-y-2 text-xs leading-relaxed text-mm-txs">
        {PAYOUT_AUTHORIZATION_PARAGRAPHS.map((p) => (
          <p key={p.slice(0, 32)}>{p}</p>
        ))}
      </div>
      <label className="flex items-start gap-2 text-sm font-medium text-mm-g">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-mm-crd"
        />
        {PAYOUT_AUTHORIZATION_CHECKBOX}
      </label>
    </div>
  );
}
