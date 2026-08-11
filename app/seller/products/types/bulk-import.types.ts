export type {
  ImportReport,
  ImportRowResult,
  ImportRowStatus,
  ImportSummary,
} from '@/lib/product-import/types';

/** Pasos del modal de carga masiva. */
export type BulkImportStep = 'upload' | 'preview' | 'done';
