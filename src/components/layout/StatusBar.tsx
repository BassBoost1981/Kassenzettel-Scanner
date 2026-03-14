// Bottom status bar showing sidecar AI status / Statusleiste mit KI-Status
import { useSidecar } from "@/hooks/useSidecar";
import { cn } from "@/lib/utils";

const statusConfig: Record<string, { color: string; label: string }> = {
  running: { color: "bg-green-500", label: "KI bereit" },
  starting: { color: "bg-yellow-500", label: "KI wird geladen..." },
  error: { color: "bg-red-500", label: "KI Fehler" },
  "model-missing": { color: "bg-orange-500", label: "Modell fehlt" },
  stopped: { color: "bg-gray-500", label: "KI gestoppt" },
  unknown: { color: "bg-gray-400", label: "KI Status unbekannt" },
};

export function StatusBar() {
  const { status } = useSidecar();
  const config = statusConfig[status] ?? statusConfig.unknown;

  return (
    <div className="flex h-8 items-center border-t border-border bg-muted/50 px-4 text-xs text-muted-foreground">
      <span className={cn("mr-2 inline-block h-2 w-2 rounded-full", config.color)} />
      <span>{config.label}</span>
    </div>
  );
}
