// Main app layout shell / Haupt-App-Layout
import { useEffect, useState } from "react";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { Sidebar } from "@/components/layout/Sidebar";
import { StatusBar } from "@/components/layout/StatusBar";
import { ModelDownload } from "@/components/onboarding/ModelDownload";
import { checkModelExists, startLlamaServer } from "@/lib/tauri-commands";
import Router from "@/Router";

export default function App() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [checked, setChecked] = useState(false);

  // Check if model exists on mount / Modell-Existenz beim Start prüfen
  useEffect(() => {
    checkModelExists()
      .then((exists) => {
        if (!exists) {
          setShowOnboarding(true);
        } else {
          // Model exists, start sidecar / Modell vorhanden, Sidecar starten
          startLlamaServer().catch(() => {
            // Non-critical on startup / Nicht kritisch beim Start
          });
        }
      })
      .catch(() => {
        // If check fails, show onboarding as fallback
        setShowOnboarding(true);
      })
      .finally(() => setChecked(true));
  }, []);

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
  };

  return (
    <ThemeProvider>
      <div className="flex h-screen bg-background text-foreground font-sans">
        <Sidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <main className="flex-1 overflow-auto p-6">
            <Router />
          </main>
          <StatusBar />
        </div>
      </div>
      {checked && showOnboarding && (
        <ModelDownload onComplete={handleOnboardingComplete} />
      )}
    </ThemeProvider>
  );
}
