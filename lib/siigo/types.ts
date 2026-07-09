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


