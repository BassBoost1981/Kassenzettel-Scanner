// Bottom status bar showing sidecar AI status and hardware info
// Statusleiste mit KI-Status und Hardware-Information
import { useSidecar } from "@/hooks/useSidecar";
import { useSidecarStore } from "@/store/sidecarStore";
import { cn } from "@/lib/utils";
import { Cpu, MonitorCog } from "lucide-react";

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
  const hardwareInfo = useSidecarStore((s) => s.hardwareInfo);
  const config = statusConfig[status] ?? statusConfig.unknown;

  const isGpu = hardwareInfo && !hardwareInfo.accelType.startsWith("CPU");

  return (
    <div className="flex h-8 items-center justify-between border-t border-border bg-muted/50 px-4 text-xs text-muted-foreground">
      <div className="flex items-center">
        <span className={cn("mr-2 inline-block h-2 w-2 rounded-full", config.color)} />
        <span>{config.label}</span>
      </div>
      {status === "running" && hardwareInfo && (
        <div className="flex items-center gap-1.5">
          {isGpu ? (
            <MonitorCog className="h-3.5 w-3.5" />
          ) : (
            <Cpu className="h-3.5 w-3.5" />
          )}
          <span>{hardwareInfo.accelType}</span>
        </div>
      )}
    </div>
  );
}
