// Stores (markets) hook / Märkte-Hook
import { useEffect } from "react";
import { useStoreStore } from "../store/storeStore";

export function useStores() {
  const store = useStoreStore();

  // Fetch stores on mount / Märkte beim Mounten laden
  useEffect(() => {
    store.fetchStores();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    stores: store.stores,
    loading: store.loading,
    error: store.error,
    fetchStores: store.fetchStores,
    addStore: store.addStore,
    editStore: store.editStore,
    removeStore: store.removeStore,
  };
}
