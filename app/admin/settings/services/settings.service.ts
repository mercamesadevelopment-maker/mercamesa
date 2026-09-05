import {
  CategoryRow, CategoryInsert, CategoryUpdate,
  MeasurementUnitRow, MeasurementUnitInsert, MeasurementUnitUpdate,
  ModuleRow, ModuleInsert, ModuleUpdate,
  DocumentTypeRow, DocumentTypeInsert, DocumentTypeUpdate,
  StoreCategoryRow, StoreCategoryInsert, StoreCategoryUpdate,
  OrderMinPriceHistoryRow, OrderMinPriceHistoryInsert,
  PricingSettingsRow, PricingSettingsInsert, EnsureSiigoProductResult,
  PersonTypeRow, PersonTypeInsert, PersonTypeUpdate,
  IdentificationTypeRow, IdentificationTypeInsert, IdentificationTypeUpdate,
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

// ── Order Min Price ─────────────────────────────────────────────────────────
export async function getOrderMinPriceHistoryService(): Promise<OrderMinPriceHistoryRow[]> {
  const res = await fetch('/api/admin/order-min-price');
  return handleResponse<OrderMinPriceHistoryRow[]>(res);
}

export async function addOrderMinPriceAdjustmentService(payload: OrderMinPriceHistoryInsert): Promise<OrderMinPriceHistoryRow> {
  const res = await fetch('/api/admin/order-min-price', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<OrderMinPriceHistoryRow>(res);
}

// ── Pricing Settings ────────────────────────────────────────────────────────
export async function getPricingSettingsService(): Promise<PricingSettingsRow[]> {
  const res = await fetch('/api/admin/pricing-settings');
  return handleResponse<PricingSettingsRow[]>(res);
}

export async function addPricingSettingsService(payload: PricingSettingsInsert): Promise<PricingSettingsRow> {
  const res = await fetch('/api/admin/pricing-settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<PricingSettingsRow>(res);
}

/** Crea o verifica en Siigo los productos con los que se factura cada concepto. */
export async function ensureSiigoServiceProductsService(): Promise<{
  results: EnsureSiigoProductResult[];
  ok: boolean;
}> {
  const res = await fetch('/api/admin/pricing-settings/ensure-siigo-products', { method: 'POST' });
  return handleResponse<{ results: EnsureSiigoProductResult[]; ok: boolean }>(res);
}

// ── Person Types ────────────────────────────────────────────────────────────
export async function getPersonTypesService(): Promise<PersonTypeRow[]> {
  const res = await fetch('/api/admin/person-types');
  return handleResponse<PersonTypeRow[]>(res);
}

export async function savePersonTypeService(id: string | null, payload: PersonTypeInsert | PersonTypeUpdate): Promise<PersonTypeRow> {
  const url = id ? `/api/admin/person-types/${id}` : '/api/admin/person-types';
  const method = id ? 'PUT' : 'POST';
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<PersonTypeRow>(res);
}

export async function deletePersonTypeService(id: string): Promise<void> {
  const res = await fetch(`/api/admin/person-types/${id}`, { method: 'DELETE' });
  await handleResponse(res);
}

// ── Identification Types ────────────────────────────────────────────────────
export async function getIdentificationTypesService(): Promise<IdentificationTypeRow[]> {
  const res = await fetch('/api/admin/identification-types');
  return handleResponse<IdentificationTypeRow[]>(res);
}

export async function saveIdentificationTypeService(id: string | null, payload: IdentificationTypeInsert | IdentificationTypeUpdate): Promise<IdentificationTypeRow> {
  const url = id ? `/api/admin/identification-types/${id}` : '/api/admin/identification-types';
  const method = id ? 'PUT' : 'POST';
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<IdentificationTypeRow>(res);
}

export async function deleteIdentificationTypeService(id: string): Promise<void> {
  const res = await fetch(`/api/admin/identification-types/${id}`, { method: 'DELETE' });
  await handleResponse(res);
}
