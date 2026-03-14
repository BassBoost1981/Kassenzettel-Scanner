// Theme hook / Theme-Hook
import { useEffect } from "react";
import { useSettingsStore } from "../store/settingsStore";

export function useTheme() {
  const { theme } = useSettingsStore();

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const apply = (e: MediaQueryList | MediaQueryListEvent) => {
        root.classList.toggle("dark", e.matches);
      };
      apply(mq);
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    }
    root.classList.toggle("dark", theme === "dark");
  }, [theme]);
}
