// Product types / Produkt-Typen
export interface Product {
  id: number;
  name: string;
  category_id: number | null;
  unit: string | null;
  created_at: string;
}

export interface ProductAlias {
  id: number;
  product_id: number;
  alias: string;
}
