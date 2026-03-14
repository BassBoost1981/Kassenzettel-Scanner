// Typed Tauri command wrappers / Typisierte Tauri-Befehl-Wrapper
import { invoke } from "@tauri-apps/api/core";
import type { Receipt, ReceiptDetail, ReceiptFilter, NewReceipt, AnalysisResult } from "../types/receipt";
import type { Store } from "../types/store";

// Settings / Einstellungen
export const getSetting = (key: string) =>
  invoke<string | null>("get_setting", { key });

export const setSetting = (key: string, value: string) =>
  invoke<void>("set_setting", { key, value });

export const getAllSettings = () =>
  invoke<[string, string][]>("get_all_settings");

// Stores (markets) / Märkte
export const getStores = () =>
  invoke<Store[]>("get_stores");

export const createStore = (name: string) =>
  invoke<Store>("create_store", { name });

export const updateStore = (id: number, name: string, mergeVariants: boolean) =>
  invoke<void>("update_store", { id, name, mergeVariants });

export const deleteStore = (id: number) =>
  invoke<void>("delete_store", { id });

// Receipts / Kassenzettel
export const getReceipts = (filter?: ReceiptFilter) =>
  invoke<Receipt[]>("get_receipts", { filter: filter ?? null });

export const getReceiptDetail = (id: number) =>
  invoke<ReceiptDetail>("get_receipt_detail", { id });

export const createReceipt = (receipt: NewReceipt) =>
  invoke<Receipt>("create_receipt", { receipt });

export const deleteReceipt = (id: number) =>
  invoke<void>("delete_receipt", { id });

export const searchReceipts = (query: string) =>
  invoke<Receipt[]>("search_receipts", { query });

// Analysis / Analyse
export const analyzeReceipt = (imagePath: string) =>
  invoke<AnalysisResult>("analyze_receipt", { imagePath });

// Scanner
export const scanDocument = () =>
  invoke<string>("scan_document");

export const isScannerAvailable = () =>
  invoke<boolean>("is_scanner_available");

// Sidecar (LLM server)
export const getSidecarStatus = () =>
  invoke<string>("get_sidecar_status");

export const startLlamaServer = () =>
  invoke<void>("start_llama_server");

export const stopLlamaServer = () =>
  invoke<void>("stop_llama_server");

export const checkModelExists = () =>
  invoke<boolean>("check_model_exists");

export const downloadModel = () =>
  invoke<void>("download_model");

export const selectModelFile = () =>
  invoke<string>("select_model_file");
