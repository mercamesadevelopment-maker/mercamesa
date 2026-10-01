import React from 'react';
import { Badge } from '@/src/components/Shared';
import { PQRS_OUTCOME_LABELS, PQRS_STATUS_LABELS, type PqrsOutcome, type PqrsStatus } from '@/lib/pqrs/types';

const OUTCOME_VARIANT: Record<PqrsOutcome, 'success' | 'error' | 'info'> = {
  approved: 'success',
  rejected: 'error',
  answered: 'info',
};

/** El estado de un caso; ya resuelto, dice cómo terminó. */
export function PqrsStatusBadge({ status, outcome }: { status: PqrsStatus; outcome: PqrsOutcome | null }) {
  if (status === 'resolved' && outcome) {
    return <Badge variant={OUTCOME_VARIANT[outcome]}>{PQRS_OUTCOME_LABELS[outcome]}</Badge>;
  }

  return <Badge variant="warning">{PQRS_STATUS_LABELS[status]}</Badge>;
}
