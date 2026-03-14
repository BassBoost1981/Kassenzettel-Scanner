// Sidecar Zustand store / Sidecar-Store
import { create } from "zustand";
import {
  getSidecarStatus,
  startLlamaServer,
  stopLlamaServer,
  checkModelExists,
  downloadModel,
  selectModelFile,
  getHardwareInfo,
} from "../lib/tauri-commands";

export type SidecarStatus =
  | "stopped"
  | "starting"
  | "running"
  | "error"
  | "model-missing"
  | "unknown";

function normalizeSidecarStatus(raw: unknown): {
  status: SidecarStatus;
  error: string | null;
} {
  if (raw && typeof raw === "object" && "Error" in raw) {
    return {
      status: "error",
      error: String((raw as { Error?: unknown }).Error ?? "Unbekannter Fehler"),
    };
  }

  switch (raw) {
    case "Ready":
    case "running":
      return { status: "running", error: null };
    case "Starting":
    case "starting":
      return { status: "starting", error: null };
    case "Stopped":
    case "stopped":
      return { status: "stopped", error: null };
    case "ModelMissing":
      return { status: "model-missing", error: null };
    case "Error":
    case "error":
      return { status: "error", error: null };
    default:
      return { status: "unknown", error: null };
  }
}

interface HardwareInfo {
  accelType: string;
  gpuLayers: number;
}

interface SidecarState {
  status: SidecarStatus;
  modelExists: boolean;
  polling: boolean;
  error: string | null;
  hardwareInfo: HardwareInfo | null;
  fetchStatus: () => Promise<void>;
  startServer: () => Promise<void>;
  stopServer: () => Promise<void>;
  checkModel: () => Promise<boolean>;
  downloadModelFile: () => Promise<void>;
  selectModel: () => Promise<string>;
  fetchHardwareInfo: () => Promise<void>;
  startPolling: () => void;
  stopPolling: () => void;
}

let pollInterval: ReturnType<typeof setInterval> | null = null;

export const useSidecarStore = create<SidecarState>((set, get) => ({
  status: "unknown",
  modelExists: false,
  polling: false,
  error: null,
  hardwareInfo: null,

  fetchStatus: async () => {
    try {
      const raw = await getSidecarStatus();
      const normalized = normalizeSidecarStatus(raw);
      set({ status: normalized.status, error: normalized.error });
      // Fetch hardware info when server is running / Hardware-Info abrufen wenn Server laeuft
      if (normalized.status === "running") {
        get().fetchHardwareInfo();
      }
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

  fetchHardwareInfo: async () => {
    try {
      const info = await getHardwareInfo();
      set({ hardwareInfo: info });
    } catch {
      // Hardware info not available / Hardware-Info nicht verfuegbar
    }
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
