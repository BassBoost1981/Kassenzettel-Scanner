// Categories hook / Kategorien-Hook
import { useEffect } from "react";
import { useCategoryStore } from "@/store/categoryStore";

export function useCategories() {
  const store = useCategoryStore();

  useEffect(() => {
    store.fetchCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    categories: store.categories,
    loading: store.loading,
    error: store.error,
    fetchCategories: store.fetchCategories,
    addCategory: store.addCategory,
    removeCategory: store.removeCategory,
  };
}
