// Store (market) Zustand store / Markt-Store
import { create } from "zustand";
import type { Store } from "../types/store";
import { getStores, createStore, updateStore, deleteStore } from "../lib/tauri-commands";

interface StoreState {
  stores: Store[];
  loading: boolean;
  error: string | null;
  fetchStores: () => Promise<void>;
  addStore: (name: string) => Promise<Store>;
  editStore: (id: number, name: string, mergeVariants: boolean) => Promise<void>;
  removeStore: (id: number) => Promise<void>;
}

export const useStoreStore = create<StoreState>((set) => ({
  stores: [],
  loading: false,
  error: null,

  fetchStores: async () => {
    set({ loading: true, error: null });
    try {
      const stores = await getStores();
      set({ stores, loading: false });
    } catch (err) {
      set({ error: String(err), loading: false });
    }
  },

  addStore: async (name) => {
    const store = await createStore(name);
    set((state) => ({ stores: [...state.stores, store] }));
    return store;
  },

  editStore: async (id, name, mergeVariants) => {
    await updateStore(id, name, mergeVariants);
    set((state) => ({
      stores: state.stores.map((s) =>
        s.id === id ? { ...s, name, merge_variants: mergeVariants } : s
      ),
    }));
  },

  removeStore: async (id) => {
    await deleteStore(id);
    set((state) => ({
      stores: state.stores.filter((s) => s.id !== id),
    }));
  },
}));
