// Settings hook / Einstellungs-Hook
import { useEffect } from "react";
import { useSettingsStore } from "../store/settingsStore";

export function useSettings() {
  const store = useSettingsStore();

  // Load settings on mount / Einstellungen beim Mounten laden
  useEffect(() => {
    if (!store.loaded) {
      store.loadSettings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    theme: store.theme,
    keepImages: store.keep_images,
    gpuLayers: store.gpu_layers,
    aldiMerge: store.aldi_merge,
    loaded: store.loaded,
    setTheme: store.setTheme,
    setKeepImages: store.setKeepImages,
    setGpuLayers: store.setGpuLayers,
    setAldiMerge: store.setAldiMerge,
  };
}
