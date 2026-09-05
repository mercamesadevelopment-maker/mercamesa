export interface SiigoAuthResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export interface SiigoDocumentType {
  id: number;
  code: string;
  name: string;
  type: string;
  active: boolean;
  seller_by_item: boolean;
  cost_center: boolean;
  description: string;
}

export interface SiigoPaymentType {
  id: number;
  name: string;
  type: string;
  active: boolean;
}

export interface SiigoProductQueryParams {
  code?: string;
  created_start?: string;
  created_end?: string;
  updated_start?: string;
  updated_end?: string;
  ids?: string;
  page?: number;
  page_size?: number;
}

export interface SiigoProductPrice {
  price_list_id: number;
  value: number;
}

export interface SiigoProductTax {
  id: number;
  name: string;
  percentage: number;
}

export interface SiigoProduct {
  id: string;
  code: string;
  name: string;
  description?: string;
  active: boolean;
  tax_classification: string;
  tax_included: boolean;
  tax_application: string;
  prices?: SiigoProductPrice[];
  taxes?: SiigoProductTax[];
  unit?: string;
  unit_label?: string;
  reference?: string;
  description_html?: string;
}

export interface SiigoProductsResponse {
  pagination: {
    page: number;
    page_size: number;
    total_results: number;
  };
  results: SiigoProduct[];
}

export interface SiigoAccountGroup {
  id: number;
  name: string;
  active: boolean;
}



// ── Facturación ─────────────────────────────────────────────────────────────

/** Ítem de una factura de venta. */
export interface SiigoInvoiceItem {
  code: string;
  description?: string;
  quantity: number;
  /**
   * Precio CON impuesto incluido. Se usa en vez de `price` porque el modelo de
   * Mercamesa no guarda IVA en ninguna tabla: se envía lo que el comprador pagó
   * y Siigo desagrega base e impuesto.
   */
  taxed_price?: number;
  price?: number;
  discount?: number;
  taxes?: { id: number }[];
}

export interface SiigoInvoicePayment {
  id: number;
  value: number;
  due_date?: string;
}

export interface SiigoCustomerRef {
  identification: string;
  branch_office?: string;
}

export interface SiigoInvoicePayload {
  document: { id: number };
  date: string;
  customer: SiigoCustomerRef;
  seller: number;
  stamp?: { send: boolean };
  mail?: { send: boolean };
  observations?: string;
  items: SiigoInvoiceItem[];
  payments: SiigoInvoicePayment[];
  additional_fields?: Record<string, string>;
  /** Obligatorio si el tipo de documento tiene `cost_center: true`. */
  cost_center?: number;
}

export interface SiigoInvoiceResponse {
  id: string;
  document?: { id: number };
  number?: number;
  name?: string;
  date?: string;
  total?: number;
  stamp?: { status?: string; cufe?: string; errors?: unknown[] };
  public_url?: string;
}

// ── Terceros ────────────────────────────────────────────────────────────────

export interface SiigoCustomerPayload {
  /** "Person" o "Company". Sale de `person_types.requires_business_name`. */
  person_type: string;
  /** Código DIAN: "13" cédula, "31" NIT. Sale de `identification_types.siigo_id_type`. */
  id_type: string;
  identification: string;
  /** Una posición para Company, dos (nombre y apellido) para Person. */
  name: string[];
  branch_office?: number;
  active?: boolean;
  address?: {
    address: string;
    city: { country_code: string; state_code: string; city_code: string };
  };
  phones?: { number: string }[];
  contacts?: {
    first_name: string;
    last_name: string;
    email?: string;
    phone?: { number: string };
  }[];
}

export interface SiigoCustomer {
  id: string;
  identification: string;
  person_type?: string;
  name?: string[];
  active?: boolean;
}

export interface SiigoCustomersResponse {
  pagination?: { page: number; page_size: number; total_results: number };
  results: SiigoCustomer[];
}

// ── Creación de productos ───────────────────────────────────────────────────

export interface SiigoProductPayload {
  code: string;
  name: string;
  account_group: number;
  type?: string;
  stock_control?: boolean;
  active?: boolean;
  description?: string;
  unit_label?: string;
}
