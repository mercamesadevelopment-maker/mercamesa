'use client';

import { PhotoPicker } from '@/components/ui/photo-picker';
import { MAX_PHOTOS } from '@/lib/pqrs/rules';

interface PqrsPhotoPickerProps {
  files: File[];
  onChange: (files: File[]) => void;
  required?: boolean;
}

/** Las fotos de un caso: el selector compartido con el tope de las PQRS. */
export function PqrsPhotoPicker(props: PqrsPhotoPickerProps) {
  return <PhotoPicker {...props} max={MAX_PHOTOS} />;
}
