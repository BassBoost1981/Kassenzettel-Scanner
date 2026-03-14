// Sidecar hook / Sidecar-Hook
import { useEffect } from "react";
import { useSidecarStore } from "../store/sidecarStore";

export function useSidecar() {
  const store = useSidecarStore();

  // Start polling on mount, stop on unmount
  // Polling beim Mounten starten, beim Unmounten stoppen
  useEffect(() => {
    store.startPolling();
    return () => store.stopPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    status: store.status,
    modelExists: store.modelExists,
    error: store.error,
    startServer: store.startServer,
    stopServer: store.stopServer,
    checkModel: store.checkModel,
    downloadModel: store.downloadModelFile,
    selectModel: store.selectModel,
    refreshStatus: store.fetchStatus,
  };
}
