// Main app layout shell / Haupt-App-Layout
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { Sidebar } from "@/components/layout/Sidebar";
import { StatusBar } from "@/components/layout/StatusBar";
import Router from "@/Router";

export default function App() {
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
    </ThemeProvider>
  );
}
