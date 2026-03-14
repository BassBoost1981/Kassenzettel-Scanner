// Products hook placeholder (Phase 2) / Produkt-Hook Platzhalter (Phase 2)
import type { Product, ProductAlias } from "../types/product";

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface UseProductsReturn {
  products: Product[];
  aliases: ProductAlias[];
  loading: boolean;
}

export function useProducts(): UseProductsReturn {
  // Placeholder for Phase 2 / Platzhalter für Phase 2
  return {
    products: [],
    aliases: [],
    loading: false,
  };
}
