// Settings types / Einstellungs-Typen
export type Theme = "system" | "dark" | "light";
export type KeepImages = "keep" | "delete" | "ask";

export interface AppSettings {
  theme: Theme;
  keep_images: KeepImages;
  gpu_layers: string;
  aldi_merge: string;
}
