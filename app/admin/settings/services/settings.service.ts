import {
  CategoryRow, CategoryInsert, CategoryUpdate,
  MeasurementUnitRow, MeasurementUnitInsert, MeasurementUnitUpdate,
  ModuleRow, ModuleInsert, ModuleUpdate,
  DocumentTypeRow, DocumentTypeInsert, DocumentTypeUpdate,
  StoreCategoryRow, StoreCategoryInsert, StoreCategoryUpdate,
} from '../types/settings.types';

async function handleResponse<T>(res: Response): Promise<T> {
  const result = await res.json();
  if (!res.ok) {
    throw new Error(result.error || 'Error en la petición');
  }
  return result.data ?? result;
}

// ── Categories ─────────────────────────────────────────────────────────────
export async function getCategoriesService(): Promise<CategoryRow[]> {
  const res = await fetch('/api/admin/categories');
  return handleResponse<CategoryRow[]>(res);
}

export async function saveCategoryService(id: string | null, payload: CategoryInsert | CategoryUpdate): Promise<CategoryRow> {
  const url = id ? `/api/admin/categories/${id}` : '/api/admin/categories';
  const method = id ? 'PUT' : 'POST';
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<CategoryRow>(res);
}

export async function deleteCategoryService(id: string): Promise<void> {
  const res = await fetch(`/api/admin/categories/${id}`, { method: 'DELETE' });
  await handleResponse(res);
}

// ── Measurement Units ───────────────────────────────────────────────────────
export async function getMeasurementUnitsService(): Promise<MeasurementUnitRow[]> {
  const res = await fetch('/api/admin/measurement-units');
  return handleResponse<MeasurementUnitRow[]>(res);
}

export async function saveMeasurementUnitService(id: string | null, payload: MeasurementUnitInsert | MeasurementUnitUpdate): Promise<MeasurementUnitRow> {
  const url = id ? `/api/admin/measurement-units/${id}` : '/api/admin/measurement-units';
  const method = id ? 'PUT' : 'POST';
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<MeasurementUnitRow>(res);
}

export async function deleteMeasurementUnitService(id: string): Promise<void> {
  const res = await fetch(`/api/admin/measurement-units/${id}`, { method: 'DELETE' });
  await handleResponse(res);
}

// ── Modules ─────────────────────────────────────────────────────────────────
export async function getModulesService(): Promise<ModuleRow[]> {
  const res = await fetch('/api/admin/modules');
  return handleResponse<ModuleRow[]>(res);
}

export async function saveModuleService(id: string | null, payload: ModuleInsert | ModuleUpdate): Promise<ModuleRow> {
  const url = id ? `/api/admin/modules/${id}` : '/api/admin/modules';
  const method = id ? 'PUT' : 'POST';
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<ModuleRow>(res);
}

export async function deleteModuleService(id: string): Promise<void> {
  const res = await fetch(`/api/admin/modules/${id}`, { method: 'DELETE' });
  await handleResponse(res);
}

// ── Document Types ──────────────────────────────────────────────────────────
export async function getDocumentTypesService(): Promise<DocumentTypeRow[]> {
  const res = await fetch('/api/admin/document-types');
  return handleResponse<DocumentTypeRow[]>(res);
}

export async function saveDocumentTypeService(id: string | null, payload: DocumentTypeInsert | DocumentTypeUpdate): Promise<DocumentTypeRow> {
  const url = id ? `/api/admin/document-types/${id}` : '/api/admin/document-types';
  const method = id ? 'PUT' : 'POST';
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<DocumentTypeRow>(res);
}

export async function deleteDocumentTypeService(id: string): Promise<void> {
  const res = await fetch(`/api/admin/document-types/${id}`, { method: 'DELETE' });
  await handleResponse(res);
}

// ── Store Categories ────────────────────────────────────────────────────────
export async function getStoreCategoriesService(): Promise<StoreCategoryRow[]> {
  const res = await fetch('/api/admin/store-categories');
  return handleResponse<StoreCategoryRow[]>(res);
}

export async function saveStoreCategoryService(id: string | null, payload: StoreCategoryInsert | StoreCategoryUpdate): Promise<StoreCategoryRow> {
  const url = id ? `/api/admin/store-categories/${id}` : '/api/admin/store-categories';
  const method = id ? 'PUT' : 'POST';
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<StoreCategoryRow>(res);
}

export async function deleteStoreCategoryService(id: string): Promise<void> {
  const res = await fetch(`/api/admin/store-categories/${id}`, { method: 'DELETE' });
  await handleResponse(res);
}
