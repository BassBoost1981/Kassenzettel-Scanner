// Category Zustand store / Kategorie-Store
import { create } from "zustand";
import type { Category } from "@/types/category";
import {
  getCategories,
  createCategory,
  deleteCategory,
} from "@/lib/tauri-commands";

interface CategoryState {
  categories: Category[];
  loading: boolean;
  error: string | null;
  fetchCategories: () => Promise<void>;
  addCategory: (name: string) => Promise<Category>;
  removeCategory: (id: number) => Promise<void>;
}

function sortCategories(categories: Category[]) {
  return [...categories].sort((a, b) => a.name.localeCompare(b.name, "de"));
}

export const useCategoryStore = create<CategoryState>((set) => ({
  categories: [],
  loading: false,
  error: null,

  fetchCategories: async () => {
    set({ loading: true, error: null });
    try {
      const categories = await getCategories();
      set({ categories: sortCategories(categories), loading: false });
    } catch (err) {
      set({ error: String(err), loading: false });
    }
  },

  addCategory: async (name) => {
    const category = await createCategory(name);
    set((state) => ({
      categories: sortCategories([...state.categories, category]),
      error: null,
    }));
    return category;
  },

  removeCategory: async (id) => {
    await deleteCategory(id);
    set((state) => ({
      categories: state.categories.filter((category) => category.id !== id),
      error: null,
    }));
  },
}));
