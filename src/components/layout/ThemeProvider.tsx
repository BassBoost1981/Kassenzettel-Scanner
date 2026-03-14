// Theme provider component / Theme-Provider-Komponente
import { useEffect } from "react";
import { useTheme } from "@/hooks/useTheme";
import { useSettingsStore } from "@/store/settingsStore";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useTheme();
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);
  return <>{children}</>;
}
