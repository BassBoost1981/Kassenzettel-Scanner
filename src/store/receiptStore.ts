// Receipt Zustand store / Kassenzettel-Store
import { create } from "zustand";
import type { Receipt, ReceiptDetail, ReceiptFilter } from "../types/receipt";
import { getReceipts, getReceiptDetail, deleteReceipt, searchReceipts } from "../lib/tauri-commands";

interface ReceiptState {
  receipts: Receipt[];
  currentDetail: ReceiptDetail | null;
  filter: ReceiptFilter;
  loading: boolean;
  detailLoading: boolean;
  error: string | null;
  setFilter: (filter: ReceiptFilter) => void;
  fetchReceipts: () => Promise<void>;
  fetchDetail: (id: number) => Promise<void>;
  removeReceipt: (id: number) => Promise<void>;
  search: (query: string) => Promise<void>;
  clearDetail: () => void;
}

export const useReceiptStore = create<ReceiptState>((set, get) => ({
  receipts: [],
  currentDetail: null,
  filter: {},
  loading: false,
  detailLoading: false,
  error: null,

  setFilter: (filter) => {
    set({ filter });
  },

  fetchReceipts: async () => {
    set({ loading: true, error: null });
    try {
      const filter = get().filter;
      const hasFilter = Object.values(filter).some((v) => v !== undefined);
      const receipts = await getReceipts(hasFilter ? filter : undefined);
      set({ receipts, loading: false });
    } catch (err) {
      set({ error: String(err), loading: false });
    }
  },

  fetchDetail: async (id) => {
    set({ detailLoading: true, error: null });
    try {
      const detail = await getReceiptDetail(id);
      set({ currentDetail: detail, detailLoading: false });
    } catch (err) {
      set({ error: String(err), detailLoading: false });
    }
  },

  removeReceipt: async (id) => {
    await deleteReceipt(id);
    set((state) => ({
      receipts: state.receipts.filter((r) => r.id !== id),
      currentDetail: state.currentDetail?.id === id ? null : state.currentDetail,
    }));
  },

  search: async (query) => {
    set({ loading: true, error: null });
    try {
      const receipts = await searchReceipts(query);
      set({ receipts, loading: false });
    } catch (err) {
      set({ error: String(err), loading: false });
    }
  },

  clearDetail: () => set({ currentDetail: null }),
}));
