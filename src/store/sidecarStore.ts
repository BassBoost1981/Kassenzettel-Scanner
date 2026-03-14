// Sidecar Zustand store / Sidecar-Store
import { create } from "zustand";
import {
  getSidecarStatus,
  startLlamaServer,
  stopLlamaServer,
  checkModelExists,
  downloadModel,
  selectModelFile,
} from "../lib/tauri-commands";

export type SidecarStatus = "stopped" | "starting" | "running" | "error" | "unknown";

interface SidecarState {
  status: SidecarStatus;
  modelExists: boolean;
  polling: boolean;
  error: string | null;
  fetchStatus: () => Promise<void>;
  startServer: () => Promise<void>;
  stopServer: () => Promise<void>;
  checkModel: () => Promise<boolean>;
  downloadModelFile: () => Promise<void>;
  selectModel: () => Promise<string>;
  startPolling: () => void;
  stopPolling: () => void;
}

let pollInterval: ReturnType<typeof setInterval> | null = null;

export const useSidecarStore = create<SidecarState>((set, get) => ({
  status: "unknown",
  modelExists: false,
  polling: false,
  error: null,

  fetchStatus: async () => {
    try {
      const raw = await getSidecarStatus();
      set({ status: raw as SidecarStatus, error: null });
    } catch (err) {
      set({ status: "error", error: String(err) });
    }
  },

  startServer: async () => {
    try {
      set({ status: "starting", error: null });
      await startLlamaServer();
      await get().fetchStatus();
    } catch (err) {
      set({ status: "error", error: String(err) });
    }
  },

  stopServer: async () => {
    try {
      await stopLlamaServer();
      set({ status: "stopped", error: null });
    } catch (err) {
      set({ error: String(err) });
    }
  },

  checkModel: async () => {
    try {
      const exists = await checkModelExists();
      set({ modelExists: exists });
      return exists;
    } catch {
      return false;
    }
  },

  downloadModelFile: async () => {
    await downloadModel();
    set({ modelExists: true });
  },

  selectModel: async () => {
    const path = await selectModelFile();
    set({ modelExists: true });
    return path;
  },

  startPolling: () => {
    if (pollInterval) return;
    set({ polling: true });
    pollInterval = setInterval(() => {
      get().fetchStatus();
    }, 5000);
    // Initial fetch / Erster Abruf
    get().fetchStatus();
  },

  stopPolling: () => {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
    set({ polling: false });
  },
}));
