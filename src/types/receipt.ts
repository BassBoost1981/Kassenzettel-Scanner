// Receipt types / Kassenzettel-Typen
export interface Receipt {
  id: number;
  store_id: number;
  store_name?: string;
  date: string;
  time: string | null;
  total_amount: number;
  discount_total: number;
  deposit_total: number;
  payment_method: string | null;
  image_path: string | null;
  item_count?: number;
  created_at: string;
}

export interface ReceiptItem {
  id: number;
  receipt_id: number;
  product_id: number | null;
  raw_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  discount: number;
  deposit: number;
  category_id: number | null;
  category_name?: string;
}

export interface ReceiptDetail extends Receipt {
  items: ReceiptItem[];
}

export interface ReceiptFilter {
  store_id?: number;
  date_from?: string;
  date_to?: string;
  amount_min?: number;
  amount_max?: number;
}

export interface NewReceipt {
  store_id: number;
  date: string;
  time: string | null;
  total_amount: number;
  discount_total: number;
  deposit_total: number;
  payment_method: string | null;
  image_path: string | null;
  raw_json: string | null;
  items: NewReceiptItem[];
}

export interface NewReceiptItem {
  raw_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  discount: number;
  deposit: number;
  category_id: number | null;
  category_name?: string | null;
}

export interface AnalysisResult {
  markt: string | null;
  datum: string | null;
  uhrzeit: string | null;
  artikel: AnalyzedItem[];
  gesamtbetrag: number | null;
  rabatte_gesamt: number | null;
  pfand_gesamt: number | null;
  zahlungsart: string | null;
  raw_text: string;
  image_path: string | null;
}

export interface AnalyzedItem {
  name: string;
  artikelnummer: string | null;
  menge: number;
  einzelpreis: number;
  gesamtpreis: number;
  rabatt: number;
  pfand: number;
  kategorie: string | null;
  confidence: number;
}
