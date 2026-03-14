// Bottom status bar showing sidecar AI status / Statusleiste mit KI-Status
import { useSidecar } from "@/hooks/useSidecar";
import { cn } from "@/lib/utils";

const statusConfig: Record<string, { color: string; label: string }> = {
  Ready: { color: "bg-green-500", label: "KI bereit" },
  Starting: { color: "bg-yellow-500", label: "KI wird geladen..." },
  Error: { color: "bg-red-500", label: "KI Fehler" },
  ModelMissing: { color: "bg-orange-500", label: "Modell fehlt" },
  Stopped: { color: "bg-gray-500", label: "KI gestoppt" },
};

export function StatusBar() {
  const { status } = useSidecar();
  const config = statusConfig[status] ?? statusConfig["Stopped"];

  return (
    <div className="flex h-8 items-center border-t border-border bg-muted/50 px-4 text-xs text-muted-foreground">
      <span className={cn("mr-2 inline-block h-2 w-2 rounded-full", config.color)} />
      <span>{config.label}</span>
    </div>
  );
}
