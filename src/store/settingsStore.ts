// Settings Zustand store / Einstellungs-Store
import { create } from "zustand";
import type { Theme, KeepImages, AppSettings } from "../types/settings";
import { getAllSettings, setSetting } from "../lib/tauri-commands";

interface SettingsState extends AppSettings {
  loaded: boolean;
  loadSettings: () => Promise<void>;
  setTheme: (theme: Theme) => Promise<void>;
  setKeepImages: (keepImages: KeepImages) => Promise<void>;
  setGpuLayers: (gpuLayers: string) => Promise<void>;
  setAldiMerge: (aldiMerge: string) => Promise<void>;
}

const defaults: AppSettings = {
  theme: "system",
  keep_images: "ask",
  gpu_layers: "0",
  aldi_merge: "true",
};

export const useSettingsStore = create<SettingsState>((set) => ({
  ...defaults,
  loaded: false,

  loadSettings: async () => {
    try {
      const pairs = await getAllSettings();
      const map = Object.fromEntries(pairs);
      set({
        theme: (map["theme"] as Theme) ?? defaults.theme,
        keep_images: (map["keep_images"] as KeepImages) ?? defaults.keep_images,
        gpu_layers: map["gpu_layers"] ?? defaults.gpu_layers,
        aldi_merge: map["aldi_merge"] ?? defaults.aldi_merge,
        loaded: true,
      });
    } catch (err) {
      console.error("Failed to load settings / Einstellungen konnten nicht geladen werden:", err);
      set({ loaded: true });
    }
  },

  setTheme: async (theme) => {
    await setSetting("theme", theme);
    set({ theme });
  },

  setKeepImages: async (keepImages) => {
    await setSetting("keep_images", keepImages);
    set({ keep_images: keepImages });
  },

  setGpuLayers: async (gpuLayers) => {
    await setSetting("gpu_layers", gpuLayers);
    set({ gpu_layers: gpuLayers });
  },

  setAldiMerge: async (aldiMerge) => {
    await setSetting("aldi_merge", aldiMerge);
    set({ aldi_merge: aldiMerge });
  },
}));
