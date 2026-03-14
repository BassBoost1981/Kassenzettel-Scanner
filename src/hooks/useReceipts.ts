// Receipts hook / Kassenzettel-Hook
import { useEffect } from "react";
import { useReceiptStore } from "../store/receiptStore";
import { createReceipt } from "../lib/tauri-commands";
import type { NewReceipt, ReceiptFilter } from "../types/receipt";

export function useReceipts() {
  const store = useReceiptStore();

  // Fetch receipts on mount / Kassenzettel beim Mounten laden
  useEffect(() => {
    store.fetchReceipts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addReceipt = async (receipt: NewReceipt) => {
    const created = await createReceipt(receipt);
    await store.fetchReceipts();
    return created;
  };

  const setFilter = (filter: ReceiptFilter) => {
    store.setFilter(filter);
    store.fetchReceipts();
  };

  return {
    receipts: store.receipts,
    currentDetail: store.currentDetail,
    loading: store.loading,
    detailLoading: store.detailLoading,
    error: store.error,
    filter: store.filter,
    setFilter,
    fetchReceipts: store.fetchReceipts,
    fetchDetail: store.fetchDetail,
    removeReceipt: store.removeReceipt,
    addReceipt,
    search: store.search,
    clearDetail: store.clearDetail,
  };
}
