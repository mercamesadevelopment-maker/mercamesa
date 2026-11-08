import React from 'react';
import { PhotoGrid } from '@/components/ui/photo-grid';
import type { PqrsAttachment } from '@/lib/pqrs/types';

/** Las fotos de un caso o de un mensaje. Cada una abre en una pestaña nueva. */
export function PqrsPhotos({ attachments }: { attachments: PqrsAttachment[] }) {
  return <PhotoGrid photos={attachments} />;
}
